import { fail, ok, resolveOwnerId } from "@/lib/api";
import { listContentEvents } from "@/lib/content-operations";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: { contentItemId: string } }) {
  const ownerId = resolveOwnerId(Object.fromEntries(new URL(request.url).searchParams.entries()));
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  try {
    return ok(await listContentEvents(ownerId, params.contentItemId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content event query failed.", 500);
  }
}
