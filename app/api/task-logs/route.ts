import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase";

const fallbackLogs: Array<Record<string, unknown>> = [];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return ok(taskId ? fallbackLogs.filter((log) => log.task_id === taskId || log.taskId === taskId) : fallbackLogs);
  }

  let query = supabase.from("task_logs").select("*").order("created_at", { ascending: false }).limit(100);
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id || !body?.content) return fail("task_id and content are required");

  const payload = {
    task_id: body.task_id,
    agent_id: body.agent_id ?? null,
    run_id: body.run_id ?? null,
    type: body.type ?? "result",
    content: body.content,
    metadata: body.metadata ?? {}
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const log = { ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() };
    fallbackLogs.unshift(log);
    return ok(log, { status: 201 });
  }

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data, error } = await supabase.from("task_logs").insert({ ...payload, owner_id: ownerId }).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
