import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { decideContentApproval } from "@/lib/content-operations";
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
    decision?: "approved" | "rejected";
    decision_note?: string | null;
  }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (!body?.decision || !["approved", "rejected"].includes(body.decision)) return fail("decision must be approved or rejected");
  try {
    return ok(
      await decideContentApproval({
        ownerId,
        contentItemId: params.contentItemId,
        decision: body.decision,
        decisionNote: body.decision_note
      })
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Content approval failed.", 409);
  }
}
