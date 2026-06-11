import { fail, ok, parseJson } from "@/lib/api";

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id && !body?.command) {
    return fail("task_id or command is required");
  }

  const webhookUrl = process.env.N8N_WEBHOOK_URL;
  if (!webhookUrl) {
    return ok({ payload: body, triggered: false, reason: "N8N_WEBHOOK_URL is not configured" });
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    return fail(`n8n webhook failed with ${response.status}`, 502);
  }

  const result = await response.json().catch(() => ({ ok: true }));
  return ok({ triggered: true, result });
}
