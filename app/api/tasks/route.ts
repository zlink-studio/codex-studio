import { cleanEmptyRelations, fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection, writeCollection } from "@/lib/local-store";
import { syncProjectState } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await readCollection<any>("tasks"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.title || !body?.description) {
    return fail("title and description are required");
  }

  const riskLevel = String(body.risk_level ?? body.riskLevel ?? "low");
  const needsApproval = riskLevel === "high" || riskLevel === "critical";
  const taskPayload: any = {
    id: crypto.randomUUID(),
    ...cleanEmptyRelations(body, ["project_id", "assigned_agent_id"]),
    risk_level: riskLevel,
    approval_required: Boolean(body.approval_required ?? body.approvalRequired ?? needsApproval),
    approval_status: needsApproval ? "pending" : body.approval_status ?? "not_required",
    board_status: needsApproval ? "waiting_boss_approval" : body.board_status ?? body.status ?? "todo",
    status: needsApproval ? "waiting_boss_approval" : body.status ?? "todo",
    review_status: body.review_status ?? "not_required",
    assigned_agent_role: body.assigned_agent_role ?? body.assignedAgentRole ?? null,
    model_policy: body.model_policy ?? body.modelPolicy ?? null,
    input_requirements: body.input_requirements ?? body.inputRequirements ?? null,
    output_requirements: body.output_requirements ?? body.outputRequirements ?? null,
    result: body.result ?? null,
    outputs: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  await appendCollectionItem<any>("tasks", taskPayload);

  if (needsApproval) {
    await appendCollectionItem<any>("approvals", {
      id: crypto.randomUUID(),
      task_id: taskPayload.id,
      status: "pending",
      decision_note: "�߷���������Ҫ������������",
      created_at: new Date().toISOString(),
      decided_at: null
    });
  }

  await syncProjectState(String(taskPayload.project_id ?? ""));
  return ok(taskPayload, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const currentTasks = await readCollection<any>("tasks");
  const currentTask = currentTasks.find((item) => item.id === body.id);
  if (!currentTask) return fail("task not found", 404);

  const boardStatus = typeof body.board_status === "string" ? body.board_status : undefined;
  if ((boardStatus === "in_progress" || boardStatus === "review") && currentTask.approval_status === "pending") {
    return fail("This task is waiting for owner approval and cannot move into execution.", 409);
  }
  if ((boardStatus === "in_progress" || boardStatus === "review") && currentTask.approval_status === "rejected") {
    return fail("This task was rejected and cannot move into execution.", 409);
  }

  const nextOutputs =
    body.append_output && typeof body.append_output === "object"
      ? [
          ...(currentTask.outputs ?? []),
          {
            agentId: (body.append_output as Record<string, unknown>).agentId ?? currentTask.assigned_agent_id ?? currentTask.assignedAgentId ?? "owner",
            content: String((body.append_output as Record<string, unknown>).content ?? ""),
            createdAt: new Date().toISOString()
          }
        ]
      : undefined;

  const status = typeof body.status === "string" ? body.status : boardStatus;
  const reviewStatus =
    boardStatus === "review" ? "pending" : typeof body.review_status === "string" ? body.review_status : undefined;
  const { id: _id, append_output: _appendOutput, ...bodyWithoutId } = cleanEmptyRelations(body, ["project_id", "assigned_agent_id", "parent_task_id"]);
  const patch = {
    ...bodyWithoutId,
    ...(nextOutputs ? { outputs: nextOutputs } : {}),
    ...(boardStatus ? { board_status: boardStatus } : {}),
    ...(status ? { status } : {}),
    ...(reviewStatus ? { review_status: reviewStatus } : {}),
    updated_at: new Date().toISOString()
  };

  const task = await patchCollectionItem<any>("tasks", body.id, patch);
  if (!task) return fail("task not found", 404);

  if (boardStatus === "review") {
    const reviews = await readCollection<any>("quality-reviews");
    const exists = reviews.find((item) => item.task_id === task.id && item.status === "pending");
    if (!exists) {
      await appendCollectionItem<any>("quality-reviews", {
        id: crypto.randomUUID(),
        task_id: task.id,
        reviewer_agent_id: task.assigned_agent_id ?? task.assignedAgentId ?? null,
        status: "pending",
        score: null,
        checklist: [
          { label: "�����������Ŀ��", passed: false },
          { label: "����������״̬�Ѵ���", passed: false },
          { label: "���Խ����������˻�ͻ�", passed: false }
        ],
        notes: "�����ѽ��븴�˶��С�",
        created_at: new Date().toISOString(),
        decided_at: null
      });
    }
  }

  const logs = await readCollection<any>("task-logs");
  logs.unshift({
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: task.assigned_agent_id ?? task.assignedAgentId ?? null,
    type: "action",
    content: boardStatus
      ? `�����Ѵ� ${currentTask.board_status ?? currentTask.boardStatus ?? currentTask.status} �ƶ��� ${boardStatus}`
      : "������Ϣ�Ѹ���",
    metadata: { source: "local_tasks_patch" },
    created_at: new Date().toISOString()
  });
  await writeCollection("task-logs", logs);
  await syncProjectState(String(task.project_id ?? task.projectId ?? ""));

  return ok(task);
}
