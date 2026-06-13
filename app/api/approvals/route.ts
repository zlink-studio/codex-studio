import { fail, ok, parseJson } from "@/lib/api";
import { tasks } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(tasks.filter((task) => task.approvalStatus === "pending"));

  const { data, error } = await supabase.from("approvals").select("*, tasks(*)").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function PATCH(request: Request) {
  const body = await parseJson<{
    approval_id?: string;
    task_id?: string;
    status?: "approved" | "rejected";
    decision_note?: string;
  }>(request);
  if ((!body?.approval_id && !body?.task_id) || !body.status) {
    return fail("approval_id or task_id, and status are required");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, decided_at: new Date().toISOString() });

  let approvalId = body.approval_id;
  if (!approvalId && body.task_id) {
    const { data: approval, error: lookupError } = await supabase
      .from("approvals")
      .select("id")
      .eq("task_id", body.task_id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupError) return fail(lookupError.message, 500);
    approvalId = approval?.id;
  }

  const taskPatch =
    body.status === "approved"
      ? { approval_status: "approved", board_status: "todo", status: "todo", updated_at: new Date().toISOString() }
      : { approval_status: "rejected", board_status: "blocked", status: "blocked", updated_at: new Date().toISOString() };

  if (!approvalId && body.task_id) {
    const { data, error } = await supabase.from("tasks").update(taskPatch).eq("id", body.task_id).select("*").single();
    if (error) return fail(error.message, 500);
    return ok(data);
  }

  const { data, error } = await supabase
    .from("approvals")
    .update({
      status: body.status,
      decision_note: body.decision_note,
      decided_at: new Date().toISOString()
    })
    .eq("id", approvalId)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);

  await supabase.from("tasks").update(taskPatch).eq("id", data.task_id);
  return ok(data);
}
