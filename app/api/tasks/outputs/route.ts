import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";
import { fail, ok, parseJson } from "@/lib/api";

type TaskRow = {
  id: string;
  status?: string;
  board_status?: string;
  review_status?: string;
  outputs?: Array<{ agentId: string; content: string; createdAt: string }>;
};

export async function POST(request: Request) {
  const body = await parseJson<{
    task_id?: string;
    agent_id?: string;
    content?: string;
    status?: string;
  }>(request);

  if (!body?.task_id || !body.content) {
    return fail("task_id and content are required");
  }

  const rows = await readCollection<TaskRow>("tasks");
  const task = rows.find((item) => item.id === body.task_id);
  if (!task) return fail("Task not found", 404);

  const output = {
    agentId: body.agent_id ?? "owner",
    content: body.content,
    createdAt: new Date().toISOString()
  };

  const nextTask = await patchCollectionItem<TaskRow>("tasks", task.id, {
    outputs: [...(task.outputs ?? []), output],
    status: body.status ?? task.status ?? "in_progress",
    board_status: body.status ?? task.board_status ?? "in_progress",
    review_status: task.review_status ?? "not_required"
  });

  await appendCollectionItem("task-logs", {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: body.agent_id ?? null,
    run_id: null,
    type: "result",
    content: body.content,
    metadata: { source: "task_output" },
    created_at: output.createdAt
  });

  return ok(nextTask);
}
