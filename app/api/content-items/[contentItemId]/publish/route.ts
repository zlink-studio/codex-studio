import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { dispatchContentItem } from "@/lib/content-operations";
import { authorizeContentAdmin, ContentAuthenticationError } from "@/lib/content-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { contentItemId: string } }) {
  try {
    authorizeContentAdmin(request);
  } catch (error) {
    return error instanceof ContentAuthenticationError ? fail(error.message, error.status) : fail("Content authentication failed.", 500);
  }
  const body = await parseJson<{ owner_id?: string; ownerId?: string }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  try {
    return ok(await dispatchContentItem(ownerId, params.contentItemId), { status: 202 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content publish dispatch failed.", 409);
  }
}
