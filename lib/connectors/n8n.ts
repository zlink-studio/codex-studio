import { createHmac } from "node:crypto";
import { accessToolCredentials } from "@/lib/credentials";

type N8nTriggerInput = {
  ownerId: string;
  workflow: "social.asset.generate" | "social.publish";
  actorId: string;
  idempotencyKey: string;
  payload: Record<string, unknown>;
};

export async function triggerN8nWorkflow(input: N8nTriggerInput) {
  const connection = await resolveN8nConnection(input);
  const body = JSON.stringify({
    workflow: input.workflow,
    idempotency_key: input.idempotencyKey,
    requested_at: new Date().toISOString(),
    ...input.payload
  });
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": input.idempotencyKey
  };
  if (connection.signingSecret) {
    headers["X-ZLink-Signature"] = createHmac("sha256", connection.signingSecret).update(body).digest("hex");
  }

  const response = await fetch(connection.webhookUrl, { method: "POST", headers, body, cache: "no-store" });
  if (!response.ok) throw new Error(`n8n ${input.workflow} trigger failed with HTTP ${response.status}.`);
  const result = (await response.json().catch(() => ({ accepted: true }))) as Record<string, unknown>;
  return {
    accepted: true,
    executionId: stringOrNull(result.execution_id ?? result.executionId ?? result.id),
    result
  };
}

async function resolveN8nConnection(input: N8nTriggerInput) {
  const connectionId = process.env.N8N_TOOL_CONNECTION_ID?.trim();
  if (connectionId) {
    const credentials = await accessToolCredentials({
      ownerId: input.ownerId,
      connectionId,
      actorType: "workflow",
      actorId: input.actorId,
      purpose: input.workflow,
      metadata: { idempotencyKey: input.idempotencyKey }
    });
    const webhookUrl = stringOrNull(credentials.webhookUrl ?? credentials.webhook_url);
    if (!webhookUrl) throw new Error("The n8n tool connection does not contain webhookUrl.");
    assertHttpUrl(webhookUrl);
    return {
      webhookUrl,
      signingSecret: stringOrNull(credentials.signingSecret ?? credentials.signing_secret)
    };
  }

  const webhookUrl = process.env.N8N_SOCIAL_WEBHOOK_URL?.trim() || process.env.N8N_WEBHOOK_URL?.trim();
  if (!webhookUrl) throw new Error("N8N_TOOL_CONNECTION_ID or N8N_SOCIAL_WEBHOOK_URL is required.");
  assertHttpUrl(webhookUrl);
  const signingSecret = process.env.N8N_OUTBOUND_SECRET?.trim() || null;
  if (process.env.NODE_ENV === "production" && !signingSecret) {
    throw new Error("N8N_OUTBOUND_SECRET is required when the environment webhook fallback is used in production.");
  }
  return { webhookUrl, signingSecret };
}

function assertHttpUrl(value: string) {
  const parsed = new URL(value);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("n8n webhook must use HTTP or HTTPS.");
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("n8n webhook must use HTTPS in production.");
  }
}

function stringOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
