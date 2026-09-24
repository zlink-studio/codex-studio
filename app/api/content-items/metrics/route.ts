import { fail, ok, resolveOwnerId } from "@/lib/api";
import { getContentOperationsMetrics } from "@/lib/content-metrics";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  try {
    return ok(await getContentOperationsMetrics(ownerId, Number(searchParams.get("days") ?? 28)), {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content metrics failed.", 500);
  }
}
