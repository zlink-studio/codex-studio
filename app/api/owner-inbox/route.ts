import { ok, fail } from "@/lib/api";
import { getOwnerInbox } from "@/lib/workflow-engine";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const inbox = await getOwnerInbox();
    const db = createSupabaseServerClient();
    const ownerId = process.env.DEMO_OWNER_ID;
    if (!db || !ownerId) return ok({ ...inbox, pendingContentApprovals: [], recentContentNotifications: [] });
    const [{ data: pendingContentApprovals, error: pendingError }, { data: recentContentNotifications, error: noticeError }] =
      await Promise.all([
        db
          .from("content_items")
          .select("id,project_id,platform,account_scope,title,caption,scheduled_at,quality_score,approval_level,approval_status,status,created_at")
          .eq("owner_id", ownerId)
          .eq("approval_status", "pending")
          .order("created_at", { ascending: false })
          .limit(50),
        db
          .from("content_items")
          .select("id,platform,title,publication_url,published_at,approval_level,status")
          .eq("owner_id", ownerId)
          .eq("status", "published")
          .eq("approval_level", "L1")
          .order("published_at", { ascending: false })
          .limit(20)
      ]);
    if (pendingError) throw new Error(pendingError.message);
    if (noticeError) throw new Error(noticeError.message);
    return ok({
      ...inbox,
      pendingContentApprovals: pendingContentApprovals ?? [],
      recentContentNotifications: recentContentNotifications ?? []
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to load owner inbox", 500);
  }
}
