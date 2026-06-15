import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";
import { appendProjectLog, syncProjectState } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get("task_id");
  const rows = await readCollection<any>("quality-reviews");
  return ok(taskId ? rows.filter((item) => item.task_id === taskId) : rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.task_id) return fail("task_id is required");

  const record = {
    id: crypto.randomUUID(),
    task_id: body.task_id,
    reviewer_agent_id: body.reviewer_agent_id ?? null,
    status: body.status ?? "pending",
    score: body.score ?? null,
    checklist: body.checklist ?? [],
    notes: body.notes ?? null,
    created_at: new Date().toISOString(),
    decided_at: null
  };
  await appendCollectionItem<any>("quality-reviews", record);
  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id && !body?.task_id) return fail("id or task_id is required");

  const reviews = await readCollection<any>("quality-reviews");
  const tasks = await readCollection<any>("tasks");
  const deliverables = await readCollection<any>("deliverables");
  const review = body.id ? reviews.find((item) => item.id === body.id) : reviews.find((item) => item.task_id === body.task_id);
  if (!review) return fail("review not found", 404);

  const taskId = String(review.task_id);
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return fail("task not found", 404);

  const status = String(body.status ?? "approved");
  const reviewStatus =
    status === "request_changes"
      ? "rejected"
      : status === "reject"
        ? "rejected"
        : status === "approved" || status === "require_boss_approval"
          ? "approved"
          : status;

  const updated = await patchCollectionItem<any>("quality-reviews", review.id, {
    status: reviewStatus,
    score: body.score ?? null,
    checklist: body.checklist ?? review.checklist ?? [],
    notes: body.notes ?? null,
    decided_at: new Date().toISOString()
  });

  let taskPatch: Record<string, unknown>;
  let projectEventTitle = "复核完成";
  let projectEventDescription = `${task.title} 已完成复核。`;

  if (status === "approved") {
    taskPatch = {
      status: "done",
      board_status: "done",
      review_status: "approved",
      approval_status: "not_required",
      approval_required: false,
      updated_at: new Date().toISOString()
    };
    for (const deliverable of deliverables.filter((item) => item.task_id === taskId)) {
      await patchCollectionItem<any>("deliverables", deliverable.id, {
        status: "approved",
        updated_at: new Date().toISOString()
      });
    }
  } else if (status === "request_changes") {
    taskPatch = {
      status: "in_progress",
      board_status: "in_progress",
      review_status: "rejected",
      approval_status: "not_required",
      approval_required: false,
      updated_at: new Date().toISOString()
    };
    projectEventTitle = "复核要求修改";
    projectEventDescription = `${task.title} 被打回继续修改。`;
  } else if (status === "require_boss_approval") {
    taskPatch = {
      status: "review",
      board_status: "review",
      review_status: "pending",
      approval_status: "not_required",
      approval_required: false,
      updated_at: new Date().toISOString()
    };
    projectEventTitle = "复核继续推进";
    projectEventDescription = `${task.title} 保留在 Review 阶段继续处理，不再等待老板审批。`;
  } else {
    taskPatch = {
      status: "blocked",
      board_status: "blocked",
      review_status: "rejected",
      approval_status: "not_required",
      approval_required: false,
      updated_at: new Date().toISOString()
    };
    projectEventTitle = "复核拒绝";
    projectEventDescription = `${task.title} 未通过复核，已转为阻塞。`;
  }

  const updatedTask = await patchCollectionItem<any>("tasks", taskId, taskPatch);
  await appendCollectionItem("task-logs", {
    id: crypto.randomUUID(),
    task_id: taskId,
    agent_id: task.assigned_agent_id ?? null,
    run_id: null,
    type: "review",
    content: `${projectEventTitle}：${String(body.notes ?? "")}`.trim(),
    metadata: {
      review_status: status
    },
    created_at: new Date().toISOString()
  });
  await appendProjectLog({
    projectId: String(task.project_id ?? ""),
    eventType: "review_completed",
    title: projectEventTitle,
    description: projectEventDescription,
    relatedTaskId: taskId,
    relatedAgentId: task.assigned_agent_id ?? null
  });
  await syncProjectState(String(task.project_id ?? ""));

  return ok({ ...updated, task: updatedTask });
}
