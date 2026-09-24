import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { reviewContentItem } from "@/lib/content-operations";
import { authorizeContentAdmin, ContentAuthenticationError } from "@/lib/content-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { contentItemId: string } }) {
  try {
    authorizeContentAdmin(request);
  } catch (error) {
    return error instanceof ContentAuthenticationError ? fail(error.message, error.status) : fail("Content authentication failed.", 500);
  }
  const body = await parseJson<{
    owner_id?: string;
    ownerId?: string;
    reviewer_agent_id?: string | null;
    score?: number;
    notes?: string | null;
    checklist?: unknown[];
  }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (typeof body?.score !== "number") return fail("score is required");
  try {
    return ok(
      await reviewContentItem({
        ownerId,
        contentItemId: params.contentItemId,
        reviewerAgentId: body.reviewer_agent_id,
        score: body.score,
        notes: body.notes,
        checklist: body.checklist
      })
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content review failed.", 409);
  }
}
