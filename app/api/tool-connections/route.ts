import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import {
  authorizeCredentialAdmin,
  createToolConnection,
  CredentialAccessError,
  CredentialConfigurationError,
  listToolConnections,
  rotateToolConnectionCredentials
} from "@/lib/credentials";

export const dynamic = "force-dynamic";

type ConnectionBody = {
  id?: string;
  owner_id?: string;
  type?: string;
  name?: string;
  config?: Record<string, unknown>;
  credentials?: Record<string, unknown>;
};

export async function GET(request: Request) {
  try {
    authorizeCredentialAdmin(request);
    const ownerId = resolveOwnerId(Object.fromEntries(new URL(request.url).searchParams.entries()));
    if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
    return ok(await listToolConnections(ownerId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return credentialFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    authorizeCredentialAdmin(request);
    const body = await parseJson<ConnectionBody>(request);
    const ownerId = resolveOwnerId(body as Record<string, unknown> | null);
    if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
    if (!body?.type?.trim() || !body.name?.trim() || !isObject(body.credentials)) {
      return fail("type, name and non-empty credentials are required");
    }
    const connection = await createToolConnection({
      ownerId,
      type: body.type.trim(),
      name: body.name.trim(),
      config: isObject(body.config) ? body.config : {},
      credentials: body.credentials
    });
    return ok(connection, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return credentialFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    authorizeCredentialAdmin(request);
    const body = await parseJson<ConnectionBody>(request);
    const ownerId = resolveOwnerId(body as Record<string, unknown> | null);
    if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
    if (!body?.id || !isObject(body.credentials)) return fail("id and non-empty credentials are required");

    const connection = await rotateToolConnectionCredentials({
      ownerId,
      connectionId: body.id,
      credentials: body.credentials,
      config: isObject(body.config) ? body.config : undefined
    });
    return ok(connection, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return credentialFailure(error);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0);
}

function credentialFailure(error: unknown) {
  if (error instanceof CredentialConfigurationError) return fail(error.message, 503);
  if (error instanceof CredentialAccessError) {
    return fail(error.message, error.message === "Invalid credential admin token." ? 401 : 400);
  }
  return fail(error instanceof Error ? error.message : "Credential operation failed.", 500);
}
