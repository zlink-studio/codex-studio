import { fail, ok } from "@/lib/api";
import { getProjectDetail } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    return ok(await getProjectDetail(params.projectId));
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to load project detail", 404);
  }
}
