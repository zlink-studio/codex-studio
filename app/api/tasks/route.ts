import { cleanEmptyRelations, fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { tasks } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(tasks);

  const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.title || !body?.description) {
    return fail("title and description are required");
  }

  const riskLevel = String(body.risk_level ?? body.riskLevel ?? "low");
  const needsApproval = riskLevel === "high" || riskLevel === "critical";
  const taskPayload = {
    ...cleanEmptyRelations(body, ["project_id", "assigned_agent_id"]),
    risk_level: riskLevel,
    approval_status: needsApproval ? "pending" : body.approval_status ?? "not_required",
    board_status: body.board_status ?? body.status ?? "todo",
    review_status: body.review_status ?? "not_required"
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...taskPayload, id: crypto.randomUUID() }, { status: 201 });

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data: task, error } = await supabase.from("tasks").insert({ ...taskPayload, owner_id: ownerId }).select("*").single();
  if (error) return fail(error.message, 500);

  if (needsApproval) {
    const { error: approvalError } = await supabase.from("approvals").insert({
      owner_id: task.owner_id,
      task_id: task.id,
      requested_by_agent_id: task.assigned_agent_id,
      status: "pending",
      reason: "High-risk or critical task requires owner approval before execution."
    });
    if (approvalError) return fail(approvalError.message, 500);
  }

  return ok(task, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id) return fail("id is required");

  const boardStatus = typeof body.board_status === "string" ? body.board_status : undefined;
  const status = typeof body.status === "string" ? body.status : boardStatus;
  const reviewStatus =
    boardStatus === "review" ? "pending" : typeof body.review_status === "string" ? body.review_status : undefined;
  const { id: _id, ...bodyWithoutId } = cleanEmptyRelations(body, ["project_id", "assigned_agent_id", "parent_task_id"]);
  const patch = {
    ...bodyWithoutId,
    ...(boardStatus ? { board_status: boardStatus } : {}),
    ...(status ? { status } : {}),
    ...(reviewStatus ? { review_status: reviewStatus } : {}),
    updated_at: new Date().toISOString()
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    const task = tasks.find((item) => item.id === body.id);
    return ok({ ...(task ?? { id: body.id }), ...patch });
  }

  const { data: task, error } = await supabase.from("tasks").update(patch).eq("id", body.id).select("*").single();
  if (error) return fail(error.message, 500);

  if (boardStatus === "review" && task.owner_id) {
    await supabase.from("quality_reviews").insert({
      owner_id: task.owner_id,
      task_id: task.id,
      reviewer_agent_id: task.assigned_agent_id,
      status: "pending",
      checklist: [
        { label: "输出符合任务目标", passed: false },
        { label: "风险和审批状态已处理", passed: false },
        { label: "可交付给老板或客户", passed: false }
      ]
    });
  }

  return ok(task);
}
