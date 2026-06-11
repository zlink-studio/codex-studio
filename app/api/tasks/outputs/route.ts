import { fail, ok, parseJson } from "@/lib/api";
import { tasks } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

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

  const output = {
    agentId: body.agent_id ?? "owner",
    content: body.content,
    createdAt: new Date().toISOString()
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const task = tasks.find((item) => item.id === body.task_id);
    return ok({
      ...(task ?? { id: body.task_id }),
      outputs: [...(task?.outputs ?? []), output],
      status: body.status ?? task?.status ?? "in_progress"
    });
  }

  const { data: task, error: readError } = await supabase.from("tasks").select("outputs").eq("id", body.task_id).single();
  if (readError) return fail(readError.message, 500);

  const outputs = Array.isArray(task.outputs) ? task.outputs : [];
  const { data, error } = await supabase
    .from("tasks")
    .update({
      outputs: [...outputs, output],
      status: body.status ?? "in_progress",
      board_status: body.status ?? "in_progress",
      updated_at: new Date().toISOString()
    })
    .eq("id", body.task_id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);

  await supabase.from("task_logs").insert({
    owner_id: data.owner_id,
    task_id: body.task_id,
    agent_id: body.agent_id ?? null,
    type: "result",
    content: body.content,
    metadata: { source: "task_output" }
  });

  return ok(data);
}
