import { timingSafeEqual } from "node:crypto";
import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { dispatchQueuedContent } from "@/lib/content-operations";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const expected = process.env.CONTENT_SCHEDULER_TOKEN?.trim();
  if (!expected) return fail("CONTENT_SCHEDULER_TOKEN is not configured", 503);
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    return fail("Invalid scheduler token", 401);
  }
  const body = await parseJson<{ owner_id?: string; ownerId?: string; limit?: number }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  try {
    return ok(await dispatchQueuedContent(ownerId, body?.limit));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Due content dispatch failed.", 500);
  }
}
