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
  const taskId = typeof body.task_id === "string" ? body.task_id : null;
  let currentTask: Record<string, any> | null = null;

  if (taskId) {
    const { data: taskRow, error: taskReadError } = await supabase.from("tasks").select("*").eq("id", taskId).maybeSingle();
    if (taskReadError) return fail(taskReadError.message, 500);
    currentTask = taskRow;
  }

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

  let reworkTask: Record<string, any> | null = null;
  if (status === "approved") {
    await supabase
      .from("tasks")
      .update({ status: "done", board_status: "done", review_status: "approved", updated_at: new Date().toISOString() })
      .eq("id", data.task_id);
  } else if (status === "rejected") {
    const decidedAt = new Date().toISOString();
    await supabase
      .from("tasks")
      .update({ status: "blocked", board_status: "blocked", review_status: "rejected", updated_at: decidedAt })
      .eq("id", data.task_id);

    if (currentTask?.owner_id) {
      const { data: insertedTask, error: reworkError } = await supabase
        .from("tasks")
        .insert({
          owner_id: currentTask.owner_id,
          project_id: currentTask.project_id,
          assigned_agent_id: currentTask.assigned_agent_id,
          parent_task_id: currentTask.id,
          title: `返工：${currentTask.title}`,
          description: [
            "Review Gate 未通过，需要返工。",
            "",
            `原任务：${currentTask.title}`,
            `拒绝原因：${typeof body.notes === "string" && body.notes ? body.notes : "需要补充质量、风险或交付细节。"}`,
            "",
            "返工要求：",
            "- 补齐缺失信息或重新生成输出。",
            "- 说明修正点和剩余风险。",
            "- 完成后再次进入 Review Gate。"
          ].join("\n"),
          task_type: currentTask.task_type ?? "review",
          priority: currentTask.priority ?? "medium",
          risk_level: currentTask.risk_level ?? "medium",
          approval_status: currentTask.approval_status === "approved" ? "approved" : "not_required",
          status: "todo",
          board_status: "todo",
          review_status: "not_required",
          created_by: "review_gate"
        })
        .select("*")
        .single();

      if (reworkError) return fail(reworkError.message, 500);
      reworkTask = insertedTask;

      await supabase.from("task_logs").insert({
        owner_id: currentTask.owner_id,
        task_id: currentTask.id,
        agent_id: currentTask.assigned_agent_id,
        type: "review",
        content: `Review 未通过，已生成返工任务：${insertedTask.title}`,
        metadata: {
          source: "quality_review",
          rework_task_id: insertedTask.id,
          review_id: data.id
        }
      });
    }
  }

  return ok({ ...data, rework_task: reworkTask });
}
