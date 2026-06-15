import { ok } from "@/lib/api";
import { readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

type ModelRunRow = {
  id: string;
  agent_run_id?: string | null;
  task_id?: string | null;
  agent_id?: string | null;
  provider: string;
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  estimated_cost?: number;
  latency_ms?: number;
  status?: string;
  error?: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentRunId = searchParams.get("agent_run_id");
  const taskId = searchParams.get("task_id");
  const agentId = searchParams.get("agent_id");

  let rows = await readCollection<ModelRunRow>("model-runs");
  if (agentRunId) rows = rows.filter((row) => row.agent_run_id === agentRunId);
  if (taskId) rows = rows.filter((row) => row.task_id === taskId);
  if (agentId) rows = rows.filter((row) => row.agent_id === agentId);
  return ok(rows);
}
