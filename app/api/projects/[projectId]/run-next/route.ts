import { fail, ok } from "@/lib/api";
import { runNextTaskForProject } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    return ok(await runNextTaskForProject(params.projectId), { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to run next task", 409);
  }
}
