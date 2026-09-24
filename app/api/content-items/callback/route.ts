import { fail, ok } from "@/lib/api";
import { handleContentCallback, type ContentCallback } from "@/lib/content-operations";
import { verifyN8nCallbackSignature } from "@/lib/connectors/callback-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    if (!verifyN8nCallbackSignature(rawBody, request.headers.get("x-zlink-signature"))) {
      return fail("Invalid n8n callback signature", 401);
    }
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Callback authentication failed.", 503);
  }

  let body: ContentCallback;
  try {
    body = JSON.parse(rawBody) as ContentCallback;
  } catch {
    return fail("Callback body must be valid JSON");
  }
  if (!body.event_id || !body.content_item_id || !body.job_type || !body.status) {
    return fail("event_id, content_item_id, job_type and status are required");
  }
  if (!["asset_generation", "publish"].includes(body.job_type) || !["succeeded", "failed"].includes(body.status)) {
    return fail("Unsupported callback job_type or status");
  }
  try {
    return ok(await handleContentCallback(body));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content callback failed.", 409);
  }
}
