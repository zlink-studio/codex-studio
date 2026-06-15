import { appendCollectionItem, readCollection } from "@/lib/local-store";
import { fail, ok, parseJson } from "@/lib/api";

export const dynamic = "force-dynamic";

type TaskLogRow = {
  id: string;
  task_id: string;
  agent_id?: string | null;
  run_id?: string | null;
  type: string;
  content: string;
  metadata?: Record<string, unknown>;
  created_at: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const rows = await readCollection<TaskLogRow>("task-logs");
  return ok(taskId ? rows.filter((row) => row.task_id === taskId) : rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id || !body?.content) return fail("task_id and content are required");

  const log: TaskLogRow = {
    id: crypto.randomUUID(),
    task_id: String(body.task_id),
    agent_id: body.agent_id ? String(body.agent_id) : null,
    run_id: body.run_id ? String(body.run_id) : null,
    type: String(body.type ?? "result"),
    content: String(body.content),
    metadata: (body.metadata as Record<string, unknown> | undefined) ?? {},
    created_at: new Date().toISOString()
  };

  await appendCollectionItem("task-logs", log);
  return ok(log, { status: 201 });
}
