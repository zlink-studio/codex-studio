import { fail, ok } from "@/lib/api";
import { runProjectToCompletion } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";
// Model calls can run long; 60s is the ceiling that works on every Vercel plan.
export const maxDuration = 60;

export async function POST(
  _request: Request,
  { params }: { params: { projectId: string } }
) {
  try {
    return ok(await runProjectToCompletion(params.projectId, { cycleLimit: 3 }), { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to run project cycle", 409);
  }
}
