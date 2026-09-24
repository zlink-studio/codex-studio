import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  randomUUID,
  timingSafeEqual
} from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase";

type JsonObject = Record<string, unknown>;

type CredentialEnvelope = {
  version: 1;
  algorithm: "aes-256-gcm";
  keyVersion: string;
  iv: string;
  authTag: string;
  ciphertext: string;
};

type ConnectionInput = {
  ownerId: string;
  type: string;
  name: string;
  config?: JsonObject;
  credentials: JsonObject;
};

type CredentialAccessInput = {
  ownerId: string;
  connectionId: string;
  actorType: "system" | "agent" | "owner" | "workflow";
  actorId: string;
  purpose: string;
  agentId?: string | null;
  taskId?: string | null;
  metadata?: JsonObject;
};

const SECRET_KEY_PATTERN = /(api.?key|access.?token|refresh.?token|secret|password|passwd|credential|private.?key|authorization|cookie)/i;

export class CredentialConfigurationError extends Error {}

export class CredentialAccessError extends Error {}

export function isCredentialEncryptionConfigured() {
  try {
    getEncryptionKeys();
    return true;
  } catch {
    return false;
  }
}

export function isCredentialAdminConfigured() {
  return Boolean(process.env.CREDENTIAL_ADMIN_TOKEN?.trim());
}

export function authorizeCredentialAdmin(request: Request) {
  const expected = process.env.CREDENTIAL_ADMIN_TOKEN?.trim();
  if (!expected) throw new CredentialConfigurationError("CREDENTIAL_ADMIN_TOKEN is not configured.");

  const authorization = request.headers.get("authorization") ?? "";
  const provided = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new CredentialAccessError("Invalid credential admin token.");
  }
}

export function assertPublicToolConfig(config: JsonObject) {
  const sensitivePaths = findSensitivePaths(config);
  if (sensitivePaths.length > 0) {
    throw new CredentialAccessError(
      `Public tool config contains secret-like fields: ${sensitivePaths.join(", ")}. Move them to credentials.`
    );
  }
}

export async function listToolConnections(ownerId: string) {
  const db = requireDatabase();
  const { data, error } = await db
    .from("tool_connections")
    .select(
      "id,owner_id,type,name,config,is_enabled,credential_status,credential_key_version,last_checked_at,created_at,updated_at"
    )
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false });
  if (error) throw new CredentialAccessError(error.message);
  return data ?? [];
}

export async function createToolConnection(input: ConnectionInput) {
  const db = requireDatabase();
  const id = randomUUID();
  const config = input.config ?? {};
  assertPublicToolConfig(config);
  const encrypted = encryptCredentials(input.credentials, input.ownerId, id);

  const { data, error } = await db
    .from("tool_connections")
    .insert({
      id,
      owner_id: input.ownerId,
      type: input.type,
      name: input.name,
      config,
      credential_ciphertext: encrypted.envelope,
      credential_key_version: encrypted.keyVersion,
      credential_status: "active",
      updated_at: new Date().toISOString()
    })
    .select(
      "id,owner_id,type,name,config,is_enabled,credential_status,credential_key_version,last_checked_at,created_at,updated_at"
    )
    .single();
  if (error) throw new CredentialAccessError(error.message);
  return data;
}

export async function rotateToolConnectionCredentials(input: {
  ownerId: string;
  connectionId: string;
  credentials: JsonObject;
  config?: JsonObject;
}) {
  const db = requireDatabase();
  if (input.config) assertPublicToolConfig(input.config);
  const encrypted = encryptCredentials(input.credentials, input.ownerId, input.connectionId);
  const update: JsonObject = {
    credential_ciphertext: encrypted.envelope,
    credential_key_version: encrypted.keyVersion,
    credential_status: "active",
    updated_at: new Date().toISOString()
  };
  if (input.config) update.config = input.config;

  const { data, error } = await db
    .from("tool_connections")
    .update(update)
    .eq("id", input.connectionId)
    .eq("owner_id", input.ownerId)
    .select(
      "id,owner_id,type,name,config,is_enabled,credential_status,credential_key_version,last_checked_at,created_at,updated_at"
    )
    .maybeSingle();
  if (error) throw new CredentialAccessError(error.message);
  if (!data) throw new CredentialAccessError("Tool connection not found.");
  return data;
}

// This is the only supported plaintext credential access path. It refuses to
// return decrypted data unless the corresponding success audit row is stored.
export async function accessToolCredentials(input: CredentialAccessInput): Promise<JsonObject> {
  const db = requireDatabase();
  if (!input.actorId.trim() || !input.purpose.trim()) {
    throw new CredentialAccessError("actorId and purpose are required for credential access.");
  }
  const baseAudit = {
    owner_id: input.ownerId,
    actor_type: input.actorType,
    actor_id: input.actorId,
    agent_id: input.agentId ?? null,
    task_id: input.taskId ?? null,
    purpose: input.purpose,
    access_type: "decrypt",
    metadata: input.metadata ?? {}
  };

  const { data: connection, error: readError } = await db
    .from("tool_connections")
    .select("id,credential_ciphertext,credential_status")
    .eq("id", input.connectionId)
    .eq("owner_id", input.ownerId)
    .maybeSingle();

  if (readError || !connection) {
    await writeFailureAudit(db, {
      ...baseAudit,
      tool_connection_id: null,
      success: false,
      error_code: readError ? "connection_read_failed" : "connection_not_found",
      metadata: { ...baseAudit.metadata, requestedConnectionId: input.connectionId }
    });
    throw new CredentialAccessError(readError?.message ?? "Tool connection not found.");
  }

  if (connection.credential_status !== "active" || !connection.credential_ciphertext) {
    await writeFailureAudit(db, {
      ...baseAudit,
      tool_connection_id: connection.id,
      success: false,
      error_code: "credentials_not_active"
    });
    throw new CredentialAccessError("Tool connection credentials are not active.");
  }

  let credentials: JsonObject;
  try {
    credentials = decryptCredentials(connection.credential_ciphertext, input.ownerId, connection.id);
  } catch (error) {
    await writeFailureAudit(db, {
      ...baseAudit,
      tool_connection_id: connection.id,
      success: false,
      error_code: "decryption_failed"
    });
    throw error;
  }

  const { error: auditError } = await db.from("credential_access_logs").insert({
    ...baseAudit,
    tool_connection_id: connection.id,
    success: true,
    error_code: null
  });
  if (auditError) {
    throw new CredentialAccessError(`Credential access denied because audit logging failed: ${auditError.message}`);
  }

  return credentials;
}

export async function listCredentialAccessLogs(ownerId: string, limit = 100) {
  const db = requireDatabase();
  const safeLimit = Math.max(1, Math.min(limit, 500));
  const { data, error } = await db
    .from("credential_access_logs")
    .select("*")
    .eq("owner_id", ownerId)
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (error) throw new CredentialAccessError(error.message);
  return data ?? [];
}

function encryptCredentials(credentials: JsonObject, ownerId: string, connectionId: string) {
  if (!credentials || Array.isArray(credentials) || Object.keys(credentials).length === 0) {
    throw new CredentialAccessError("credentials must be a non-empty object.");
  }
  const { activeVersion, keys } = getEncryptionKeys();
  const key = keys.get(activeVersion);
  if (!key) throw new CredentialConfigurationError("Active credential encryption key is unavailable.");

  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(getAdditionalAuthenticatedData(ownerId, connectionId));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(credentials), "utf8"), cipher.final()]);
  const envelope: CredentialEnvelope = {
    version: 1,
    algorithm: "aes-256-gcm",
    keyVersion: activeVersion,
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64")
  };
  return { envelope: JSON.stringify(envelope), keyVersion: activeVersion };
}

function decryptCredentials(rawEnvelope: string, ownerId: string, connectionId: string): JsonObject {
  let envelope: CredentialEnvelope;
  try {
    envelope = JSON.parse(rawEnvelope) as CredentialEnvelope;
  } catch {
    throw new CredentialAccessError("Credential envelope is invalid.");
  }
  if (envelope.version !== 1 || envelope.algorithm !== "aes-256-gcm" || !envelope.keyVersion) {
    throw new CredentialAccessError("Credential envelope version is unsupported.");
  }

  const key = getEncryptionKeys().keys.get(envelope.keyVersion);
  if (!key) throw new CredentialConfigurationError(`Credential encryption key ${envelope.keyVersion} is unavailable.`);

  try {
    const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(envelope.iv, "base64"));
    decipher.setAAD(getAdditionalAuthenticatedData(ownerId, connectionId));
    decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(envelope.ciphertext, "base64")),
      decipher.final()
    ]).toString("utf8");
    const parsed = JSON.parse(plaintext) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("not an object");
    }
    return parsed as JsonObject;
  } catch {
    throw new CredentialAccessError("Credential decryption failed.");
  }
}

function getEncryptionKeys() {
  const activeVersion = process.env.CREDENTIAL_ENCRYPTION_KEY_VERSION?.trim() || "v1";
  const current = process.env.CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!current) throw new CredentialConfigurationError("CREDENTIAL_ENCRYPTION_KEY is not configured.");

  const keys = new Map<string, Buffer>();
  const previous = process.env.CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS?.trim();
  if (previous) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(previous);
    } catch {
      throw new CredentialConfigurationError("CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS must be a JSON object.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new CredentialConfigurationError("CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS must be a JSON object.");
    }
    for (const [version, value] of Object.entries(parsed)) {
      if (typeof value !== "string") throw new CredentialConfigurationError(`Encryption key ${version} must be a string.`);
      keys.set(version, parseEncryptionKey(value, version));
    }
  }
  keys.set(activeVersion, parseEncryptionKey(current, activeVersion));
  return { activeVersion, keys };
}

function parseEncryptionKey(value: string, version: string) {
  const key = /^[a-f\d]{64}$/i.test(value) ? Buffer.from(value, "hex") : Buffer.from(value, "base64");
  if (key.length !== 32) {
    throw new CredentialConfigurationError(`Credential encryption key ${version} must decode to exactly 32 bytes.`);
  }
  return key;
}

function getAdditionalAuthenticatedData(ownerId: string, connectionId: string) {
  return Buffer.from(`zlink:tool-connection:${ownerId}:${connectionId}`, "utf8");
}

function findSensitivePaths(value: unknown, path = "config"): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap((item, index) => findSensitivePaths(item, `${path}[${index}]`));
  return Object.entries(value as JsonObject).flatMap(([key, child]) => [
    ...(SECRET_KEY_PATTERN.test(key) ? [`${path}.${key}`] : []),
    ...findSensitivePaths(child, `${path}.${key}`)
  ]);
}

function requireDatabase() {
  const db = createSupabaseServerClient();
  if (!db) throw new CredentialConfigurationError("Supabase is not configured for credential storage.");
  return db;
}

async function writeFailureAudit(db: ReturnType<typeof requireDatabase>, row: JsonObject) {
  const { error } = await db.from("credential_access_logs").insert(row);
  if (error) throw new CredentialAccessError(`Credential failure audit could not be stored: ${error.message}`);
}

export function getCredentialKeyFingerprint() {
  const { activeVersion, keys } = getEncryptionKeys();
  const key = keys.get(activeVersion);
  return key ? `${activeVersion}:${createHash("sha256").update(key).digest("hex").slice(0, 12)}` : null;
}

export function verifyCredentialEncryption() {
  const ownerId = randomUUID();
  const connectionId = randomUUID();
  const probe = randomBytes(24).toString("hex");
  const encrypted = encryptCredentials({ probe }, ownerId, connectionId);
  const roundTrip = decryptCredentials(encrypted.envelope, ownerId, connectionId).probe === probe;

  let rowBindingRejected = false;
  try {
    decryptCredentials(encrypted.envelope, ownerId, randomUUID());
  } catch {
    rowBindingRejected = true;
  }

  const parsed = JSON.parse(encrypted.envelope) as CredentialEnvelope;
  const ciphertext = Buffer.from(parsed.ciphertext, "base64");
  ciphertext[0] = ciphertext[0] ^ 1;
  parsed.ciphertext = ciphertext.toString("base64");
  let tamperRejected = false;
  try {
    decryptCredentials(JSON.stringify(parsed), ownerId, connectionId);
  } catch {
    tamperRejected = true;
  }

  return {
    algorithm: "aes-256-gcm" as const,
    keyVersion: encrypted.keyVersion,
    roundTrip,
    rowBindingRejected,
    tamperRejected,
    plaintextAbsentFromEnvelope: !encrypted.envelope.includes(probe)
  };
}
