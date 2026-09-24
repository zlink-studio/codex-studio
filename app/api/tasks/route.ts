import { cleanEmptyRelations, fail, ok, parseJson } from "@/lib/api";
import { classifyTaskApproval, taskApprovalState } from "@/lib/approval-policy";
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
  const skills = await readCollection<any>("skills");
  const suggestedSkills = Array.isArray(body.suggested_skills ?? body.suggestedSkills)
    ? ((body.suggested_skills ?? body.suggestedSkills) as unknown[]).map(String)
    : [];
  const selectedSkills = skills.filter((skill) => suggestedSkills.includes(String(skill.slug)));
  const approvalDecision = classifyTaskApproval({ ...body, risk_level: riskLevel }, selectedSkills);
  const approvalState = taskApprovalState(approvalDecision);
  const requestedStatus = String(body.board_status ?? body.status ?? "todo");
  const initialStatus = approvalDecision.level === "L0" || approvalDecision.level === "L1"
    ? requestedStatus
    : approvalState.status;
  const taskPayload: any = {
    id: crypto.randomUUID(),
    ...cleanEmptyRelations(body, ["project_id", "assigned_agent_id"]),
    risk_level: riskLevel,
    approval_level: approvalDecision.level,
    approval_required: approvalState.approval_required,
    approval_status: approvalState.approval_status,
    board_status: initialStatus,
    status: initialStatus,
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

  if (approvalDecision.level === "L2" || approvalDecision.level === "L3") {
    await appendCollectionItem<any>("approvals", {
      id: crypto.randomUUID(),
      task_id: taskPayload.id,
      requested_by_agent_id: taskPayload.assigned_agent_id ?? null,
      status: approvalDecision.level === "L3" ? "manual_only" : "pending",
      reason: approvalDecision.reasons.join("；") || `${approvalDecision.level} 动作策略`,
      decision_note: approvalDecision.level === "L3" ? "L3 动作仅允许主理人人工执行。" : null,
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
  if ((boardStatus === "in_progress" || boardStatus === "review") && currentTask.approval_status === "manual_only") {
    return fail("L3 tasks are manual-only and cannot move into Agent execution.", 409);
  }

  const nextOutputs =
    body.append_output && typeof body.append_output === "object"
      ? [
          ...(currentTask.outputs ?? []),
          {
            agentId:
              (body.append_output as Record<string, unknown>).agentId ??
              currentTask.assigned_agent_id ??
              currentTask.assignedAgentId ??
              "owner",
            content: String((body.append_output as Record<string, unknown>).content ?? ""),
            createdAt: new Date().toISOString()
          }
        ]
      : undefined;

  const status = typeof body.status === "string" ? body.status : boardStatus;
  const reviewStatus = boardStatus === "review" ? "pending" : typeof body.review_status === "string" ? body.review_status : undefined;
  const { id: _id, append_output: _appendOutput, ...bodyWithoutId } = cleanEmptyRelations(body, [
    "project_id",
    "assigned_agent_id",
    "parent_task_id"
  ]);
  const policyFields = [
    "title",
    "description",
    "task_type",
    "taskType",
    "suggested_skills",
    "suggestedSkills",
    "risk_level",
    "riskLevel",
    "approval_level",
    "approvalLevel",
    "approval_required",
    "approvalRequired"
  ];
  const policyChanged = policyFields.some((field) => field in bodyWithoutId);
  const patchedSkillValue =
    bodyWithoutId.suggested_skills ??
    bodyWithoutId.suggestedSkills ??
    currentTask.suggested_skills ??
    currentTask.suggestedSkills;
  const patchedSuggestedSkills = Array.isArray(patchedSkillValue)
    ? (patchedSkillValue as unknown[]).map(String)
    : [];
  const selectedSkillsForPatch = policyChanged
    ? (await readCollection<any>("skills")).filter((skill) => patchedSuggestedSkills.includes(String(skill.slug)))
    : [];
  const approvalDecisionForPatch = policyChanged
    ? classifyTaskApproval({ ...currentTask, ...bodyWithoutId }, selectedSkillsForPatch)
    : null;
  const approvalPatch = approvalDecisionForPatch ? taskApprovalState(approvalDecisionForPatch) : null;
  const patch = {
    ...bodyWithoutId,
    ...(nextOutputs ? { outputs: nextOutputs } : {}),
    ...(boardStatus ? { board_status: boardStatus } : {}),
    ...(status ? { status } : {}),
    ...(reviewStatus ? { review_status: reviewStatus } : {}),
    ...(approvalPatch
      ? {
          approval_level: approvalPatch.approval_level,
          approval_required: approvalPatch.approval_required,
          approval_status: approvalPatch.approval_status,
          status: approvalPatch.status,
          board_status: approvalPatch.board_status
        }
      : {}),
    updated_at: new Date().toISOString()
  };

  const task = await patchCollectionItem<any>("tasks", body.id, patch);
  if (!task) return fail("task not found", 404);

  if (approvalDecisionForPatch?.level === "L2" || approvalDecisionForPatch?.level === "L3") {
    const approvals = await readCollection<any>("approvals");
    const pendingStatus = approvalDecisionForPatch.level === "L3" ? "manual_only" : "pending";
    const existing = approvals.find((item) => item.task_id === task.id && item.status === pendingStatus);
    if (!existing) {
      await appendCollectionItem("approvals", {
        id: crypto.randomUUID(),
        task_id: task.id,
        requested_by_agent_id: task.assigned_agent_id ?? null,
        status: pendingStatus,
        reason: approvalDecisionForPatch.reasons.join("；") || `${approvalDecisionForPatch.level} 动作策略`,
        decision_note: approvalDecisionForPatch.level === "L3" ? "L3 动作仅允许主理人人工执行。" : null,
        decided_at: null,
        created_at: new Date().toISOString()
      });
    }
  }

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
          { label: "结果是否覆盖任务目标", passed: false },
          { label: "数据和状态是否一致", passed: false },
          { label: "是否存在风险或外部动作冲突", passed: false }
        ],
        notes: "任务已进入复核队列。",
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
      ? `任务已从 ${currentTask.board_status ?? currentTask.boardStatus ?? currentTask.status} 移动到 ${boardStatus}`
      : "任务信息已更新",
    metadata: { source: "local_tasks_patch" },
    created_at: new Date().toISOString()
  });
  await writeCollection("task-logs", logs);
  await syncProjectState(String(task.project_id ?? task.projectId ?? ""));

  return ok(task);
}
