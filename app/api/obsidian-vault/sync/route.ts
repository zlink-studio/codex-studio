import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { ObsidianVaultConfigurationError, syncEditedRetrospectivesToReviewQueue } from "@/lib/obsidian-vault";
import { isSupabaseConfigured } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await parseJson<{ owner_id?: string; ownerId?: string }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);

  try {
    const result = await syncEditedRetrospectivesToReviewQueue(ownerId);
    return ok(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to sync Obsidian retrospectives.",
      error instanceof ObsidianVaultConfigurationError || !isSupabaseConfigured() ? 503 : 500
    );
  }
}
