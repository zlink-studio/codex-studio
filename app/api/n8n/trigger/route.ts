import { fail, ok, parseJson } from "@/lib/api";
import { createHmac } from "node:crypto";

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id && !body?.command) {
    return fail("task_id or command is required");
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return ok({ payload: body, triggered: false, reason: "N8N_WEBHOOK_URL is not configured" });
  }

  const payload = JSON.stringify(body);
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.N8N_OUTBOUND_SECRET) {
    headers["X-ZLink-Signature"] = createHmac("sha256", process.env.N8N_OUTBOUND_SECRET).update(payload).digest("hex");
  }
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers,
    body: payload,
    cache: "no-store"
  });

  if (!response.ok) {
    return fail(`n8n webhook failed with ${response.status}`, 502);
  }

  const result = await response.json().catch(() => ({ ok: true }));
  return ok({ triggered: true, result });
}
