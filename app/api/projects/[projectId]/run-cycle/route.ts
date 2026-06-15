import { fail, ok } from "@/lib/api";
import { runProjectCycle } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    return ok(await runProjectCycle(params.projectId, 3), { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to run project cycle", 409);
  }
}
