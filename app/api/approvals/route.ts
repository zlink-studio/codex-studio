import { fail, ok, parseJson } from "@/lib/api";
import { classifyTaskApproval } from "@/lib/approval-policy";
import { appendCollectionItem, readCollection, patchCollectionItem } from "@/lib/local-store";
import { appendProjectLog, syncProjectState } from "@/lib/workflow-engine";
import { decideContentApproval } from "@/lib/content-operations";
import { authorizeContentAdmin, ContentAuthenticationError } from "@/lib/content-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const approvals = await readCollection<any>("approvals");
  return ok(approvals);
}

export async function PATCH(request: Request) {
  const body = await parseJson<{
    approval_id?: string;
    task_id?: string;
    content_item_id?: string;
    status?: "approved" | "rejected";
    decision_note?: string;
  }>(request);
  if ((!body?.approval_id && !body?.task_id && !body?.content_item_id) || !body.status) {
    return fail("approval_id, task_id or content_item_id, and status are required");
  }

  const approvals = await readCollection<any>("approvals");
  const approval = body.approval_id
    ? approvals.find((item) => item.id === body.approval_id)
    : body.content_item_id
      ? approvals.find((item) => item.subject_type === "content_item" && item.subject_id === body.content_item_id && item.status === "pending")
      : approvals.find((item) => item.task_id === body.task_id && item.status === "pending");

  const contentItemId = approval?.subject_type === "content_item" ? approval.subject_id : body.content_item_id;
  if (contentItemId) {
    try {
      authorizeContentAdmin(request);
    } catch (error) {
      return error instanceof ContentAuthenticationError ? fail(error.message, error.status) : fail("Content authentication failed.", 500);
    }
    const ownerId = process.env.DEMO_OWNER_ID;
    if (!ownerId) return fail("DEMO_OWNER_ID is required", 503);
    try {
      return ok(
        await decideContentApproval({
          ownerId,
          contentItemId,
          decision: body.status,
          decisionNote: body.decision_note
        })
      );
    } catch (error) {
      return fail(error instanceof Error ? error.message : "Content approval failed.", 409);
    }
  }

  const taskId = approval?.task_id ?? body.task_id;
  if (!taskId) return fail("task not found for approval", 404);
  const tasks = await readCollection<any>("tasks");
  const currentTask = tasks.find((item) => item.id === taskId);
  if (!currentTask) return fail("task not found", 404);
  if (classifyTaskApproval(currentTask).level === "L3") {
    return fail("L3 actions are manual-only and cannot be approved for Agent execution.", 409);
  }

  if (approval) {
    await patchCollectionItem<any>("approvals", approval.id, {
      status: body.status,
      decision_note: body.decision_note ?? null,
      decided_at: new Date().toISOString()
    });
  }

  const taskPatch =
    body.status === "approved"
      ? {
          approval_status: "approved",
          approvalStatus: "approved",
          board_status: "todo",
          boardStatus: "todo",
          status: "todo",
          updated_at: new Date().toISOString()
        }
      : {
          approval_status: "rejected",
          approvalStatus: "rejected",
          board_status: "blocked",
          boardStatus: "blocked",
          status: "blocked",
          updated_at: new Date().toISOString()
        };

  const task = await patchCollectionItem<any>("tasks", taskId, taskPatch);
  if (!task) return fail("task not found", 404);

  await appendCollectionItem("task-logs", {
    id: crypto.randomUUID(),
    task_id: taskId,
    agent_id: task.assigned_agent_id ?? null,
    run_id: null,
    type: "approval",
    content: body.status === "approved" ? "老板已批准任务继续执行。" : "老板已拒绝任务，任务已阻塞。",
    metadata: {
      decision_note: body.decision_note ?? null
    },
    created_at: new Date().toISOString()
  });
  await appendProjectLog({
    projectId: String(task.project_id ?? ""),
    eventType: body.status === "approved" ? "review_completed" : "task_blocked",
    title: body.status === "approved" ? "老板审批通过" : "老板审批拒绝",
    description:
      body.status === "approved"
        ? `${task.title} 已通过老板审批，回到待执行。`
        : `${task.title} 被老板拒绝，已转为阻塞。`,
    relatedTaskId: taskId,
    relatedAgentId: task.assigned_agent_id ?? null
  });
  await syncProjectState(String(task.project_id ?? ""));

  return ok(task);
}
