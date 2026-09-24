import { fail, ok, parseJson } from "@/lib/api";
import { executeAgentRun } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";
// Model calls can run long; 60s is the ceiling that works on every Vercel plan.
export const maxDuration = 60;

type ExecuteBody = {
  task_id?: string;
  taskId?: string;
  agent_id?: string;
  agentId?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<ExecuteBody>(request);
  const taskId = body?.task_id ?? body?.taskId;
  if (!taskId) return fail("task_id is required");

  try {
    const result = await executeAgentRun(taskId, body?.agent_id ?? body?.agentId ?? null);
    return ok(result, { status: 201 });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Execution failed", 409);
  }
}
