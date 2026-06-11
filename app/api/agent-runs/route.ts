import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok([]);

  let query = supabase.from("agent_runs").select("*").order("created_at", { ascending: false }).limit(100);
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id || !body?.agent_id) return fail("task_id and agent_id are required");

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    return ok({ ...body, id: crypto.randomUUID(), status: body.status ?? "queued", created_at: new Date().toISOString() }, { status: 201 });
  }

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data, error } = await supabase
    .from("agent_runs")
    .insert({
      owner_id: ownerId,
      task_id: body.task_id,
      agent_id: body.agent_id,
      status: body.status ?? "queued",
      model: body.model,
      input: body.input ?? {},
      output: body.output ?? {},
      prompt_tokens: body.prompt_tokens ?? 0,
      completion_tokens: body.completion_tokens ?? 0,
      cost: body.cost ?? 0,
      error: body.error ?? null,
      started_at: body.started_at ?? null,
      finished_at: body.finished_at ?? null
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
