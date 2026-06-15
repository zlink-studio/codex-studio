import { appendCollectionItem, readCollection } from "@/lib/local-store";
import { fail, ok, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type AgentRunRow = {
  id: string;
  task_id?: string | null;
  agent_id?: string | null;
  status: string;
  model?: string | null;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  prompt_tokens?: number;
  completion_tokens?: number;
  cost?: number;
  error?: string | null;
  started_at?: string | null;
  finished_at?: string | null;
  created_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const rows = await readCollection<AgentRunRow>("agent-runs");
  return ok(taskId ? rows.filter((row) => row.task_id === taskId) : rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id || !body?.agent_id) return fail("task_id and agent_id are required");

  const row: AgentRunRow = {
    id: crypto.randomUUID(),
    task_id: String(body.task_id),
    agent_id: String(body.agent_id),
    status: String(body.status ?? "queued"),
    model: body.model ? String(body.model) : null,
    input: (body.input as Record<string, unknown> | undefined) ?? {},
    output: (body.output as Record<string, unknown> | undefined) ?? {},
    prompt_tokens: Number(body.prompt_tokens ?? 0),
    completion_tokens: Number(body.completion_tokens ?? 0),
    cost: Number(body.cost ?? 0),
    error: body.error ? String(body.error) : null,
    started_at: body.started_at ? String(body.started_at) : null,
    finished_at: body.finished_at ? String(body.finished_at) : null,
    created_at: new Date().toISOString()
  };

  await appendCollectionItem("agent-runs", row);
  return ok(row, { status: 201 });
}
