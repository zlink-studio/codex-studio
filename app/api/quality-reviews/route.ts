import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok([]);

  let query = supabase.from("quality_reviews").select("*, tasks(*)").order("created_at", { ascending: false });
  if (taskId) query = query.eq("task_id", taskId);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id) return fail("task_id is required");

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, id: crypto.randomUUID(), status: body.status ?? "pending" }, { status: 201 });

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data, error } = await supabase
    .from("quality_reviews")
    .insert({
      owner_id: ownerId,
      task_id: body.task_id,
      reviewer_agent_id: body.reviewer_agent_id ?? null,
      status: body.status ?? "pending",
      score: body.score ?? null,
      checklist: body.checklist ?? [],
      notes: body.notes ?? null
    })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id && !body?.task_id) return fail("id or task_id is required");

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, decided_at: new Date().toISOString() });

  const status = typeof body.status === "string" ? body.status : "approved";
  let query = supabase
    .from("quality_reviews")
    .update({
      status,
      score: body.score,
      checklist: body.checklist,
      notes: body.notes,
      decided_at: new Date().toISOString()
    });

  query = body.id ? query.eq("id", body.id) : query.eq("task_id", body.task_id);
  const { data, error } = await query.select("*").single();
  if (error) return fail(error.message, 500);

  if (status === "approved") {
    await supabase.from("tasks").update({ status: "done", board_status: "done", review_status: "approved" }).eq("id", data.task_id);
  } else if (status === "rejected") {
    await supabase.from("tasks").update({ status: "blocked", board_status: "blocked", review_status: "rejected" }).eq("id", data.task_id);
  }

  return ok(data);
}
