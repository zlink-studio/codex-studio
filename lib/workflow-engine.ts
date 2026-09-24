import { promises as fs } from "fs";
import path from "path";
import { assertTaskExecutionAllowed, classifyApproval, classifyTaskApproval, taskApprovalState } from "@/lib/approval-policy";
import { getDefaultModelPolicies } from "@/lib/llm/catalog";
import { appendCollectionItem, patchCollectionItem, readCollection, writeCollection } from "@/lib/local-store";
import { resolveModelPolicy, runLLM } from "@/lib/llm/router";
import { formatMemoriesForPrompt, retrieveMemoryForTask } from "@/lib/memory/service";
import type {
  Agent,
  Deliverable,
  DeliverableStatus,
  DeliverableType,
  ModelPolicy,
  Project,
  ProjectLog,
  ProjectLogEventType,
  QualityReview,
  Skill,
  SkillRun,
  Task
} from "@/lib/types";

type AnyRow = Record<string, any>;

export type WorkflowTaskDraft = {
  title: string;
  description: string;
  assigned_agent_role: string;
  suggested_skills: string[];
  model_policy: string;
  priority: Task["priority"];
  risk_level: Task["riskLevel"];
  status: Task["status"];
  input_requirements: string;
  output_requirements: string;
  approval_required: boolean;
  task_type?: string;
};

export type ProjectDetailPayload = {
  project: Project;
  tasks: Task[];
  agents: Agent[];
  deliverables: Deliverable[];
  projectLogs: ProjectLog[];
  taskLogs: AnyRow[];
  agentRuns: AnyRow[];
  modelRuns: AnyRow[];
  skillRuns: SkillRun[];
  qualityReviews: QualityReview[];
  metrics: {
    total: number;
    done: number;
    inProgress: number;
    review: number;
    blocked: number;
    waitingBossApproval: number;
  };
  participatingAgents: Array<{
    agent: Agent;
    currentTask: Task | null;
    recentOutput: string | null;
  }>;
  highRiskTasks: Task[];
  blockedTasks: Task[];
  pendingApprovalTasks: Task[];
};

type AgentRunExecutionResult = {
  task: AnyRow;
  project: AnyRow | null;
  agentRun: AnyRow;
  modelRun: AnyRow;
  skillRuns: AnyRow[];
  log: AnyRow;
  deliverables: Deliverable[];
  warning?: string;
  reviews?: AnyRow[];
};

type AutoReviewContext = {
  riskNotes?: string;
  reviewNotes?: string;
  needsBossApproval?: boolean;
  hasActionSkill?: boolean;
};

type ReviewStepResult = {
  decision: "approved" | "request_changes" | "blocked";
  score: number | null;
  checklist: Array<{ label: string; passed: boolean }>;
  notes: string;
  review: AnyRow;
};

export type MeetingRunResult = {
  topic: string;
  messages: Array<{ agentId: string; speaker: string; content: string }>;
  conclusion: string;
  actionItems: string[];
};

const MAX_AUTO_REVIEW_ATTEMPTS = 2;

const STATUS_PROGRESS: Record<string, number> = {
  done: 100,
  review: 70,
  in_progress: 40,
  todo: 10,
  backlog: 0,
  blocked: 0,
  waiting_boss_approval: 0
};

const PRIORITY_WEIGHT: Record<Task["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1
};

const DELIVERABLE_EXT: Record<DeliverableType, string> = {
  markdown: "md",
  html: "html",
  json: "json",
  text: "txt",
  image_prompt: "txt",
  report: "md",
  wordpress_draft: "json"
};

export async function createProjectFromGoal(input: {
  goal: string;
  projectId?: string | null;
}) {
  const projects = await readCollection<AnyRow>("projects");
  let project = input.projectId ? projects.find((item) => item.id === input.projectId) ?? null : null;

  const brief = await generateProjectBrief({
    goal: input.goal,
    project
  });

  if (!project) {
    const createdAt = new Date().toISOString();
    project = {
      id: crypto.randomUUID(),
      name: brief.project_name,
      client_name: brief.client_name,
      objective: brief.objective,
      client_profile: brief.client_profile,
      brief: brief.brief,
      progress: 0,
      stage: "planning",
      risk_level: brief.risk_level,
      due_date: brief.due_date ?? null,
      agent_ids: [],
      created_at: createdAt,
      updated_at: createdAt
    };
    await appendCollectionItem<any>("projects", project);
    await appendProjectLog({
      projectId: project.id,
      eventType: "project_created",
      title: "项目已创建",
      description: `根据老板目标创建项目：${project.name}`
    });
  } else {
    project = await patchCollectionItem<any>("projects", project.id, {
      objective: brief.objective,
      client_name: brief.client_name,
      client_profile: brief.client_profile,
      brief: brief.brief,
      risk_level: brief.risk_level,
      due_date: brief.due_date ?? project.due_date ?? null,
      updated_at: new Date().toISOString()
    });
  }

  if (!project) throw new Error("Failed to create or update project");

  await appendProjectLog({
    projectId: project.id,
    eventType: "brief_generated",
    title: "Project Brief 已生成",
    description: brief.brief
  });

  return { project, brief };
}

export async function createTasksForProject(input: {
  project: AnyRow;
  goal: string;
}) {
  const [agents, skills] = await Promise.all([
    readCollection<AnyRow>("agents"),
    readCollection<AnyRow>("skills")
  ]);
  const taskDrafts = await generateTaskPlan({
    project: input.project,
    goal: input.goal,
    agents,
    skills
  });

  const createdTasks: AnyRow[] = [];
  const suggestedAgents = new Set<string>();
  const risks = new Set<string>();

  for (let index = 0; index < taskDrafts.length; index += 1) {
    const draft = taskDrafts[index];
    const assignedAgent = pickAgentForRole(draft.assigned_agent_role, agents, draft.suggested_skills);
    const selectedSkillRows = skills.filter((skill) => draft.suggested_skills.includes(skill.slug));
    const now = new Date().toISOString();
    const requestedStatus = normalizeTaskStatus(draft.status);
    const approvalDecision = classifyTaskApproval(draft as AnyRow, selectedSkillRows);
    const approvalState = taskApprovalState(approvalDecision);
    const initialStatus = approvalDecision.level === "L0" || approvalDecision.level === "L1"
      ? requestedStatus === "waiting_boss_approval" ? "todo" : requestedStatus
      : approvalState.status;
    const hasExternalActionSkill = selectedSkillRows.some(isExternalActionSkill);
    const task = {
      id: crypto.randomUUID(),
      project_id: input.project.id,
      title: draft.title,
      description: draft.description,
      task_type: draft.task_type ?? normalizeTaskType(draft.suggested_skills[0]),
      assigned_agent_id: assignedAgent?.id ?? null,
      assigned_agent_role: draft.assigned_agent_role,
      suggested_skills: draft.suggested_skills,
      model_policy: draft.model_policy,
      priority: draft.priority,
      risk_level: draft.risk_level,
      status: initialStatus,
      board_status: initialStatus,
      approval_level: approvalDecision.level,
      approval_status: approvalState.approval_status,
      approval_required: approvalState.approval_required,
      review_status: "not_required",
      input_requirements: draft.input_requirements,
      output_requirements: draft.output_requirements,
      result: null,
      outputs: [],
      sort_order: index,
      created_at: now,
      updated_at: now
    };

    await appendCollectionItem("tasks", task);
    if (approvalDecision.level === "L2" || approvalDecision.level === "L3") {
      await appendCollectionItem("approvals", {
        id: crypto.randomUUID(),
        task_id: task.id,
        requested_by_agent_id: assignedAgent?.id ?? null,
        status: approvalDecision.level === "L3" ? "manual_only" : "pending",
        reason: approvalDecision.reasons.join("；") || `${approvalDecision.level} 动作策略`,
        decision_note: approvalDecision.level === "L3" ? "L3 动作仅允许主理人人工执行。" : null,
        decided_at: null,
        created_at: now
      });
    }
    createdTasks.push(task);
    if (assignedAgent?.id) suggestedAgents.add(assignedAgent.id);
    if (approvalDecision.level !== "L0" || hasExternalActionSkill) {
      risks.add(`${task.title} classified as ${approvalDecision.level}: ${approvalDecision.reasons.join("；")}`);
    }

    await appendProjectLog({
      projectId: input.project.id,
      eventType: "task_created",
      title: "任务已创建",
      description: `${task.title} 已进入项目执行列表。`,
      relatedTaskId: task.id,
      relatedAgentId: assignedAgent?.id ?? null
    });

    await appendCollectionItem("task-logs", {
      id: crypto.randomUUID(),
      task_id: task.id,
      agent_id: assignedAgent?.id ?? null,
      run_id: null,
      type: "action",
      content: `项目经理已创建任务：${task.title}`,
      metadata: {
        source: "command_center",
        model_policy: task.model_policy,
        assigned_agent_role: task.assigned_agent_role
      },
      created_at: now
    });
  }

  await syncProjectState(input.project.id);
  return {
    createdTasks,
    suggestedAgents: Array.from(suggestedAgents),
    risks: Array.from(risks),
    nextAction: "The system will immediately execute the first cycle and write logs, results, and deliverables back to the project."
  };
}

export async function runMeeting(input: {
  topic: string;
  participantAgentIds: string[];
  hostAgentId?: string | null;
}): Promise<MeetingRunResult> {
  const agents = await readCollection<AnyRow>("agents");
  const participants = input.participantAgentIds
    .map((id) => agents.find((agent) => agent.id === id))
    .filter(Boolean) as AnyRow[];
  if (!participants.length) throw new Error("No database-backed participants were found for this meeting.");

  const host = agents.find((agent) => agent.id === input.hostAgentId) ?? participants[0];
  const fallbackMessages = participants.map((agent) => ({
    agentId: String(agent.id),
    speaker: `${agent.name}（${agent.title ?? agent.department ?? "Agent"}）`,
    content: fallbackMeetingContribution(agent, input.topic)
  }));
  const fallback: MeetingRunResult = {
    topic: input.topic,
    messages: fallbackMessages,
    conclusion: `围绕“${input.topic}”，先推进低风险且可验收的事项；涉及发布、资金或外部承诺的动作必须遵守 L0–L3 审批策略。`,
    actionItems: ["明确负责人和验收标准", "将结论拆成数据库任务", "需要审批的动作进入主理人收件箱"]
  };

  const llmResult = await runLLM({
    responseFormat: "json_object",
    metadata: {
      meeting_topic: input.topic,
      host_agent_id: host?.id ?? null,
      participant_agent_ids: participants.map((agent) => agent.id)
    },
    messages: [
      {
        role: "system",
        content:
          '你是 AI 公司会议主持人。根据数据库中的岗位信息，让每位参会 Agent 只从自己的岗位职责发言，最后形成结论和待办。不得执行外部动作。只输出 JSON：{"messages":[{"agent_id":"","content":""}],"conclusion":"","action_items":[""]}'
      },
      {
        role: "user",
        content: JSON.stringify({
          topic: input.topic,
          host: host ? meetingAgentProfile(host) : null,
          participants: participants.map(meetingAgentProfile)
        })
      }
    ]
  });
  if (llmResult.status === "failed" || !llmResult.content) return fallback;

  try {
    const parsed = JSON.parse(extractJson(llmResult.content)) as AnyRow;
    const rawMessages = Array.isArray(parsed.messages) ? parsed.messages : [];
    const parsedByAgentId = new Map(
      rawMessages.map((message: AnyRow) => [String(message.agent_id ?? message.agentId ?? ""), String(message.content ?? "")])
    );
    return {
      topic: input.topic,
      messages: fallbackMessages.map((message) => ({
        ...message,
        content: parsedByAgentId.get(message.agentId) || message.content
      })),
      conclusion: String(parsed.conclusion ?? fallback.conclusion),
      actionItems: Array.isArray(parsed.action_items ?? parsed.actionItems)
        ? (parsed.action_items ?? parsed.actionItems).map(String).filter(Boolean)
        : fallback.actionItems
    };
  } catch {
    return fallback;
  }
}

export async function executeAgentRun(
  taskId: string,
  preferredAgentId?: string | null,
  reviewAttempt = 0
): Promise<AgentRunExecutionResult> {
  const [tasks, projects, agents, agentSkills, skills, skillReviews] = await Promise.all([
    readCollection<AnyRow>("tasks"),
    readCollection<AnyRow>("projects"),
    readCollection<AnyRow>("agents"),
    readCollection<AnyRow>("agent-skills"),
    readCollection<AnyRow>("skills"),
    readCollection<AnyRow>("skill-reviews")
  ]);
  const modelPolicies = getDefaultModelPolicies();

  const task = tasks.find((item) => item.id === taskId);
  if (!task) throw new Error("task not found");
  const project = projects.find((item) => item.id === task.project_id) ?? null;
  const assignedAgent =
    agents.find((item) => item.id === (preferredAgentId ?? task.assigned_agent_id ?? task.assignedAgentId)) ??
    agents.find((item) => item.agent_role === task.assigned_agent_role) ??
    agents[0];
  if (!assignedAgent) throw new Error("No available agent");

  const selectedAssignments = agentSkills.filter(
    (row) => (row.agent_id ?? row.agentId) === assignedAgent.id && row.enabled !== false
  );
  const selectedSkillRows = resolveTaskSkills(task, selectedAssignments, skills);
  const approvalDecision = assertTaskExecutionAllowed(task, selectedSkillRows);
  const selectedPolicy =
    modelPolicies.find((policy) => policy.name === task.model_policy) ??
    resolveModelPolicy({
      agent: assignedAgent,
      taskType: task.task_type,
      riskLevel: task.risk_level,
      preferredPolicy: task.model_policy
    });

  const approvedMemories = await retrieveMemoryForTask(
    {
      id: task.id,
      title: task.title,
      description: task.description,
      projectId: task.project_id ?? null,
      assignedAgentId: assignedAgent.id,
      taskType: task.task_type
    },
    assignedAgent,
    null
  );

  const memoryText = formatMemoriesForPrompt(approvedMemories);
  const startedAt = new Date().toISOString();
  const agentRun = {
    id: crypto.randomUUID(),
    task_id: task.id,
    project_id: project?.id ?? null,
    agent_id: assignedAgent.id,
    status: "running",
    model: selectedPolicy.primaryModel,
    policy_name: selectedPolicy.name,
    input: {
      project_name: project?.name ?? null,
      task_title: task.title,
      memory_count: approvedMemories.length
    },
    output: null,
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    error: null,
    started_at: startedAt,
    finished_at: null,
    created_at: startedAt
  };
  await appendCollectionItem("agent-runs", agentRun);

  await appendCollectionItem("task-logs", {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: assignedAgent.id,
    run_id: agentRun.id,
    type: "thinking",
    content: `${assignedAgent.name} 开始执行任务：${task.title}`,
    metadata: {
      project_id: project?.id ?? null,
      model_policy: selectedPolicy.name
    },
    created_at: startedAt
  });

  await appendProjectLog({
    projectId: project?.id ?? "",
    eventType: "task_started",
    title: "任务开始执行",
    description: `${assignedAgent.name} 开始处理任务：${task.title}`,
    relatedTaskId: task.id,
    relatedAgentId: assignedAgent.id
  }).catch(() => null);

  let reworkNote: string | null = null;
  if (task.review_status === "rejected") {
    const taskLogs = await readCollection<AnyRow>("task-logs");
    const lastReview = taskLogs
      .filter((log) => log.task_id === task.id && log.type === "review")
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))[0];
    if (lastReview?.content) {
      reworkNote = String(lastReview.content);
    }
  }

  // 可视化 HTML 报告比较占 token，给执行调用一个下限，避免报告被截断。
  const executionMaxTokens = Math.max(Number(selectedPolicy.maxTokens ?? 0) || 0, 6000);

  const llmResult = await runLLM({
    provider: selectedPolicy.primaryProvider,
    model: selectedPolicy.primaryModel,
    temperature: selectedPolicy.temperature,
    maxTokens: executionMaxTokens,
    responseFormat: "json_object",
    metadata: {
      task_id: task.id,
      project_id: project?.id ?? null,
      policy: selectedPolicy.name
    },
    messages: [
      {
        role: "system",
        content: [
          "你是项目执行员工。请严格输出 JSON，对任务给出结果、交付物内容、风险说明和下一状态建议。不要执行任何外部动作。",
          "若任务属于分析 / 报告 / 市场背调 / 策略方案 / 发布排期 / 投放规划类，至少产出一个 type 为 \"html\" 的可视化报告交付物：",
          "- 必须是自包含、可直接在浏览器打开的完整 HTML（含 <!doctype html> 与内联 <style>，不要引用任何外部 CDN/JS）。",
          "- 用语义化排版 + 简单可视化呈现关键数据：用纯 CSS/内联 SVG 画条形图、占比条、对比表格、时间线或排期日历表，不要依赖外部图表库。",
          "- 面向交付给客户：专业、有标题层级、有结论摘要、有数据支撑，中文撰写（除非客户资料是英文）。",
          "可以同时再产出一个 type 为 \"markdown\" 的文字版本，便于编辑。"
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `项目：${project?.name ?? "未命名项目"}`,
          `Project Brief：${project?.brief ?? project?.objective ?? ""}`,
          `任务标题：${task.title}`,
          `任务描述：${task.description}`,
          `任务类型：${task.task_type ?? "general"}`,
          `输入要求：${task.input_requirements ?? "无"}`,
          `输出要求：${task.output_requirements ?? "无"}`,
          `技能：${selectedSkillRows.map((item) => item.slug).join(", ") || "无"}`,
          `记忆：\n${memoryText}`,
          ...(reworkNote ? [`上一轮复核意见（请据此修改）：${reworkNote}`] : []),
          '请输出 JSON: {"summary":"","result":"","deliverables":[{"title":"可视化报告标题","type":"html","content":"<!doctype html>...完整HTML...","is_file":true}],"risk_notes":"","needs_boss_approval":false,"review_notes":""}'
        ].join("\n\n")
      }
    ]
  });

  const parsed = parseAgentResponse(llmResult.content, task, project, assignedAgent, selectedSkillRows);
  const hasActionSkill = selectedSkillRows.some(isExternalActionSkill);
  const shouldHoldExternalAction = hasActionSkill || Boolean(parsed.needs_boss_approval);

  const finishedAt = new Date().toISOString();
  const agentRunStatus = llmResult.status === "failed" ? "succeeded" : "succeeded";
  const modelRun = {
    id: crypto.randomUUID(),
    agent_run_id: agentRun.id,
    task_id: task.id,
    project_id: project?.id ?? null,
    agent_id: assignedAgent.id,
    policy_name: selectedPolicy.name,
    provider: llmResult.provider,
    model: llmResult.model,
    input_tokens: llmResult.inputTokens,
    output_tokens: llmResult.outputTokens,
    estimated_cost: llmResult.estimatedCost,
    latency_ms: llmResult.latencyMs,
    status: llmResult.status === "failed" ? "fallback" : "success",
    error: llmResult.error ?? null,
    created_at: finishedAt
  };
  await appendCollectionItem("model-runs", modelRun);

  const skillRunRows: AnyRow[] = [];
  for (const skill of selectedSkillRows) {
    const review = skillReviews.find((row) => (row.skill_id ?? row.skillId) === skill.id);
    const approved = !skill.approval_required || (review?.review_status ?? review?.reviewStatus) === "approved";
    const skillDecision = classifyApproval(skill);
    const pendingApproval = skillDecision.level === "L3" || (skillDecision.level === "L2" && task.approval_status !== "approved") || !approved;
    const skillRun = {
      id: crypto.randomUUID(),
      skill_id: skill.id,
      agent_id: assignedAgent.id,
      task_id: task.id,
      agent_run_id: agentRun.id,
      model_run_id: modelRun.id,
      status: pendingApproval ? "pending_approval" : "success",
      input: {
        task_title: task.title,
        project_id: project?.id ?? null
      },
      output: pendingApproval
        ? {
            recommendation: `技能 ${skill.name} 需要老板审批后才能继续外部动作。`
          }
        : {
            summary: `${skill.name} 已参与本轮任务执行。`
          },
      error: pendingApproval ? "需要审批，不直接执行外部动作。" : null,
      latency_ms: Math.max(80, Math.floor(llmResult.latencyMs / Math.max(selectedSkillRows.length, 1))),
      created_at: finishedAt
    };
    await appendCollectionItem("skill-runs", skillRun);
    skillRunRows.push(skillRun);
  }

  const taskOutput = {
    agentId: assignedAgent.id,
    content: parsed.result,
    createdAt: finishedAt
  };

  const deliverables: Deliverable[] = [];
  for (const item of parsed.deliverables) {
    const deliverable = await createDeliverable({
      project,
      task,
      agent: assignedAgent,
      title: item.title,
      type: item.type,
      content: item.content,
      status: shouldHoldExternalAction ? "review" : "draft"
    });
    deliverables.push(deliverable);
  }

  const nextStatus = "review";
  const nextApproval = "not_required";
  const taskPatch = {
    assigned_agent_id: assignedAgent.id,
    model_policy: selectedPolicy.name,
    result: parsed.result,
    outputs: [...(task.outputs ?? []), taskOutput],
    status: nextStatus,
    board_status: nextStatus,
    approval_level: approvalDecision.level,
    approval_status: approvalDecision.level === "L2" ? "approved" : nextApproval,
    review_status: "pending",
    approval_required: approvalDecision.level === "L2",
    used_memory_ids: approvedMemories.map((memory) => memory.id),
    updated_at: finishedAt
  };
  const updatedTask = await patchCollectionItem<any>("tasks", task.id, taskPatch);
  if (!updatedTask) throw new Error("failed to update task");

  const updatedAgentRun = await patchCollectionItem<any>("agent-runs", agentRun.id, {
    status: agentRunStatus,
    output: {
      summary: parsed.summary,
      result: parsed.result,
      deliverable_ids: deliverables.map((item) => item.id)
    },
    prompt_tokens: llmResult.inputTokens,
    completion_tokens: llmResult.outputTokens,
    cost: llmResult.estimatedCost,
    error: llmResult.error ?? null,
    finished_at: finishedAt
  });

  const resultLog = {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: assignedAgent.id,
    run_id: agentRun.id,
    type: "result",
    content: parsed.result,
    metadata: {
      deliverable_ids: deliverables.map((item) => item.id),
      risk_notes: parsed.risk_notes,
      model_run_id: modelRun.id
    },
    created_at: finishedAt
  };
  await appendCollectionItem("task-logs", resultLog);
  if (shouldHoldExternalAction) {
    await appendCollectionItem("task-logs", {
      id: crypto.randomUUID(),
      task_id: task.id,
      agent_id: assignedAgent.id,
      run_id: agentRun.id,
      type: "approval",
      content: "This run used action skills in suggestion mode only; no external action was executed.",
      metadata: {
        deliverable_ids: deliverables.map((item) => item.id)
      },
      created_at: finishedAt
    });
    if (project?.id) {
      await appendProjectLog({
        projectId: project.id,
        eventType: "task_completed",
        title: "Task moved to review",
        description: `${task.title} produced deliverables and kept external actions in suggestion mode.`,
        relatedTaskId: task.id,
        relatedAgentId: assignedAgent.id,
        relatedDeliverableId: deliverables[0]?.id ?? null
      });
    }
  } else if (project?.id) {
    await appendProjectLog({
      projectId: project.id,
      eventType: "task_completed",
      title: "任务进入复核",
      description: `${task.title} 已执行完成，等待 Review Gate。`,
      relatedTaskId: task.id,
      relatedAgentId: assignedAgent.id,
      relatedDeliverableId: deliverables[0]?.id ?? null
    });
  }

  await syncProjectState(project?.id ?? null);

  const baseResult: AgentRunExecutionResult = {
    task: updatedTask,
    project: project?.id ? await readProject(project.id) : null,
    agentRun: updatedAgentRun ?? agentRun,
    modelRun,
    skillRuns: skillRunRows,
    log: resultLog,
    deliverables,
    warning: shouldHoldExternalAction
      ? "This run included external-action skills, so the system produced results and drafts but did not directly publish, send, or mutate external systems."
      : undefined
  };

  return runAutoQualityReview(
    task.id,
    baseResult,
    {
      riskNotes: parsed.risk_notes,
      reviewNotes: parsed.review_notes,
      needsBossApproval: Boolean(parsed.needs_boss_approval),
      hasActionSkill
    },
    reviewAttempt
  );
}

async function runAutoQualityReview(
  taskId: string,
  baseResult: AgentRunExecutionResult,
  context: AutoReviewContext,
  attempt = 0
): Promise<AgentRunExecutionResult> {
  const [tasks, projects, agents, deliverablesAll] = await Promise.all([
    readCollection<AnyRow>("tasks"),
    readCollection<AnyRow>("projects"),
    readCollection<AnyRow>("agents"),
    readCollection<AnyRow>("deliverables")
  ]);

  const task = tasks.find((item) => item.id === taskId);
  if (!task) return { ...baseResult, reviews: [] };
  const project = projects.find((item) => item.id === task.project_id) ?? null;
  const deliverables = deliverablesAll.filter((item) => item.task_id === taskId);
  const reviews: AnyRow[] = [];

  const reviewerAgent =
    agents.find((item) => (item.agent_role ?? item.agentRole) === "reviewer") ??
    agents.find((item) => (item.agent_role ?? item.agentRole) === "leader") ??
    agents[0];

  const qualityStep = await runReviewStep("reviewer", reviewerAgent, task, project, deliverables, context);
  reviews.push(qualityStep.review);

  if (qualityStep.decision === "request_changes") {
    if (attempt < MAX_AUTO_REVIEW_ATTEMPTS) {
      const now = new Date().toISOString();
      await patchCollectionItem<any>("tasks", taskId, {
        status: "in_progress",
        board_status: "in_progress",
        review_status: "rejected",
        rework_count: Number(task.rework_count ?? 0) + 1,
        updated_at: now
      });
      await appendCollectionItem("task-logs", {
        id: crypto.randomUUID(),
        task_id: taskId,
        agent_id: reviewerAgent?.id ?? null,
        run_id: null,
        type: "review",
        content: `AI 复核：需要修改 - ${qualityStep.notes}`,
        metadata: { review_status: "rejected", attempt },
        created_at: now
      });
      await appendProjectLog({
        projectId: project?.id ?? "",
        eventType: "review_completed",
        title: "AI 复核：需要修改，自动安排返工",
        description: `${task.title}：${qualityStep.notes}`,
        relatedTaskId: taskId,
        relatedAgentId: reviewerAgent?.id ?? null
      });
      await syncProjectState(project?.id ?? null);

      const rerun = await executeAgentRun(taskId, undefined, attempt + 1);
      return { ...rerun, reviews: [...reviews, ...(rerun.reviews ?? [])] };
    }

    const hasUsableDeliverable = deliverables.length > 0;
    const shouldBlock =
      task.risk_level === "high" ||
      task.risk_level === "critical" ||
      Boolean(context.hasActionSkill) ||
      Boolean(context.needsBossApproval) ||
      !hasUsableDeliverable;
    const finalState = await finalizeTask(
      task,
      project,
      shouldBlock ? "blocked" : "done",
      shouldBlock
        ? qualityStep.notes
        : `自动返工已达到上限，但已有可用交付物，系统先归档完成。复核建议：${qualityStep.notes}`,
      reviewerAgent,
      shouldBlock ? "task_blocked" : "review_completed",
      shouldBlock ? "AI 多轮复核未通过，转人工处理" : "AI 复核完成，带改进建议归档"
    );
    return { ...baseResult, task: finalState.task, project: finalState.project, reviews };
  }

  const needsFinalSignoff =
    task.risk_level === "high" || task.risk_level === "critical" || Boolean(context.hasActionSkill) || Boolean(context.needsBossApproval);

  if (needsFinalSignoff) {
    const leaderAgent = agents.find((item) => (item.agent_role ?? item.agentRole) === "leader") ?? reviewerAgent;
    const signoffStep = await runReviewStep("leader", leaderAgent, task, project, deliverables, context, qualityStep);
    reviews.push(signoffStep.review);

    if (signoffStep.decision === "blocked") {
      const finalState = await finalizeTask(
        task,
        project,
        "blocked",
        signoffStep.notes,
        leaderAgent,
        "task_blocked",
        "AI 执行负责人暂缓该任务"
      );
      return { ...baseResult, task: finalState.task, project: finalState.project, reviews };
    }
  }

  const finalState = await finalizeTask(task, project, "done", qualityStep.notes, reviewerAgent, "review_completed", "AI 复核通过");
  return { ...baseResult, task: finalState.task, project: finalState.project, reviews };
}

async function runReviewStep(
  role: "reviewer" | "leader",
  agent: AnyRow | undefined,
  task: AnyRow,
  project: AnyRow | null,
  deliverables: AnyRow[],
  context: AutoReviewContext,
  priorStep?: ReviewStepResult
): Promise<ReviewStepResult> {
  const policy = resolveModelPolicy({
    agent: agent ? normalizeAgentRow(agent) : null,
    taskType: task.task_type,
    riskLevel: task.risk_level,
    preferredPolicy: agent?.preferred_model_policy ?? agent?.preferredModelPolicy ?? null
  });

  const deliverableSummary =
    deliverables.map((item) => `### ${item.title}\n${String(item.content ?? "").slice(0, 1500)}`).join("\n\n") || "（无交付物）";

  const systemPrompt =
    role === "reviewer"
      ? '你是质量复核 Agent，代表项目负责人对任务结果做验收。基于任务的输出要求、执行结果与交付物内容判断是否合格，如果基本满足要求就应判定通过，不要过度苛求。请输出 JSON：{"decision":"approved"|"request_changes","score":0,"checklist":[{"label":"","passed":true}],"notes":""}'
      : '你是执行负责人 Agent，代表公司最高决策者对高风险或涉及外部动作的任务结果做最终签批。除非存在明显且严重的问题，应当批准放行。请输出 JSON：{"decision":"approved"|"blocked","notes":""}';

  const userPromptParts = [
    `项目：${project?.name ?? "未命名项目"}`,
    `任务：${task.title}`,
    `任务说明：${task.description}`,
    `输出要求：${task.output_requirements ?? "无"}`,
    `风险等级：${task.risk_level}`,
    `执行结果：\n${task.result ?? "无"}`,
    `交付物：\n${deliverableSummary}`,
    `执行过程备注：风险说明=${context.riskNotes ?? "无"}；复核建议=${context.reviewNotes ?? "无"}`
  ];
  if (role === "leader" && priorStep) {
    userPromptParts.push(`质量复核结论：${priorStep.decision}，得分 ${priorStep.score ?? "无"}，备注：${priorStep.notes}`);
  }

  const llmResult = await runLLM({
    provider: policy.primaryProvider,
    model: policy.primaryModel,
    temperature: policy.temperature,
    maxTokens: policy.maxTokens,
    responseFormat: "json_object",
    metadata: {
      task_id: task.id,
      project_id: project?.id ?? null,
      policy: policy.name,
      review_role: role
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPromptParts.join("\n\n") }
    ]
  });

  let decision: ReviewStepResult["decision"] = "approved";
  let score: number | null = null;
  let checklist: Array<{ label: string; passed: boolean }> = [];
  let notes = "";

  try {
    const parsed = JSON.parse(extractJson(llmResult.content));
    const rawDecision = String(parsed.decision ?? "approved");
    decision =
      role === "leader"
        ? rawDecision === "blocked"
          ? "blocked"
          : "approved"
        : ["approved", "request_changes", "blocked"].includes(rawDecision)
          ? (rawDecision as ReviewStepResult["decision"])
          : "approved";
    score = typeof parsed.score === "number" ? parsed.score : null;
    checklist = Array.isArray(parsed.checklist) ? parsed.checklist : [];
    notes = String(parsed.notes ?? "");
  } catch {
    decision = "approved";
    notes = "AI 复核结果解析失败，按通过处理。";
  }

  if (!notes) notes = decision === "approved" ? "复核通过。" : "需要修改。";
  if (role === "leader") notes = `[最终签批] ${notes}`;

  const now = new Date().toISOString();
  const review = {
    id: crypto.randomUUID(),
    task_id: task.id,
    reviewer_agent_id: agent?.id ?? null,
    status: decision === "approved" ? "approved" : "rejected",
    score,
    checklist,
    notes,
    created_at: now,
    decided_at: now
  };
  await appendCollectionItem("quality-reviews", review);

  await appendCollectionItem("model-runs", {
    id: crypto.randomUUID(),
    agent_run_id: null,
    task_id: task.id,
    project_id: project?.id ?? null,
    agent_id: agent?.id ?? null,
    policy_name: policy.name,
    provider: llmResult.provider,
    model: llmResult.model,
    input_tokens: llmResult.inputTokens,
    output_tokens: llmResult.outputTokens,
    estimated_cost: llmResult.estimatedCost,
    latency_ms: llmResult.latencyMs,
    status: llmResult.status === "failed" ? "fallback" : "success",
    error: llmResult.error ?? null,
    created_at: now
  });

  return { decision, score, checklist, notes, review };
}

async function finalizeTask(
  task: AnyRow,
  project: AnyRow | null,
  finalStatus: "done" | "blocked",
  notes: string,
  agent: AnyRow | undefined,
  eventType: ProjectLogEventType,
  title: string
) {
  const now = new Date().toISOString();

  if (finalStatus === "done") {
    await patchCollectionItem<any>("tasks", task.id, {
      status: "done",
      board_status: "done",
      review_status: "approved",
      approval_status: task.approval_status ?? "not_required",
      approval_required: task.approval_level === "L2" || task.approval_level === "L3",
      updated_at: now
    });
    const deliverables = (await readCollection<AnyRow>("deliverables")).filter((item) => item.task_id === task.id);
    for (const deliverable of deliverables) {
      await patchCollectionItem<any>("deliverables", deliverable.id, { status: "approved", updated_at: now });
    }
  } else {
    await patchCollectionItem<any>("tasks", task.id, {
      status: "blocked",
      board_status: "blocked",
      review_status: "rejected",
      updated_at: now
    });
  }

  await appendCollectionItem("task-logs", {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: agent?.id ?? null,
    run_id: null,
    type: "review",
    content: `${title}：${notes}`.trim(),
    metadata: { review_status: finalStatus === "done" ? "approved" : "rejected" },
    created_at: now
  });
  await appendProjectLog({
    projectId: project?.id ?? "",
    eventType,
    title,
    description: `${task.title}：${notes}`,
    relatedTaskId: task.id,
    relatedAgentId: agent?.id ?? null
  });
  await syncProjectState(project?.id ?? null);

  const tasks = await readCollection<AnyRow>("tasks");
  const updatedTask = tasks.find((item) => item.id === task.id) ?? task;
  return {
    task: updatedTask,
    project: project?.id ? await readProject(project.id) : null
  };
}

export async function runNextTaskForProject(projectId: string) {
  const tasks = await getProjectTasks(projectId);
  const nextTask = [...tasks]
    .filter((task) => task.status === "todo")
    .sort(sortTasksForExecution)[0];
  if (!nextTask) throw new Error("No runnable task found");
  return executeAgentRun(nextTask.id);
}

export async function runProjectCycle(projectId: string, limit = 3) {
  const tasks = await getProjectTasks(projectId);
  const queue = [...tasks]
    .filter((task) => ["todo", "in_progress", "review"].includes(task.status))
    .sort(sortTasksForExecution)
    .slice(0, limit);
  const results: AgentRunExecutionResult[] = [];
  for (const task of queue) {
    results.push(await executeAgentRun(task.id));
  }
  await appendProjectLog({
    projectId,
    eventType: "task_started",
    title: "项目执行周期已运行",
    description: `本轮共执行 ${results.length} 条任务。`
  });
  return results;
}

const RUNNABLE_TASK_STATUSES = ["todo", "in_progress", "review"];

/**
 * 连续运行执行周期，直到项目里没有可运行任务（全部 done / blocked）或达到周期上限。
 * 这是"说任务 → 直接给结果"的项目级闭环入口：每个任务都会被执行、自动复核并落地。
 */
export async function runProjectToCompletion(
  projectId: string,
  options: { cycleLimit?: number; maxCycles?: number } = {}
) {
  const cycleLimit = options.cycleLimit ?? 3;
  const allResults: AgentRunExecutionResult[] = [];

  const initialTasks = await getProjectTasks(projectId);
  const runnableCount = initialTasks.filter((task) => RUNNABLE_TASK_STATUSES.includes(task.status)).length;
  // 给每个可运行任务预留若干周期裕量（含可能的返工），并设一个硬上限避免失控。
  const maxCycles = options.maxCycles ?? Math.min(20, Math.ceil(runnableCount / cycleLimit) + 3);

  for (let cycle = 0; cycle < maxCycles; cycle += 1) {
    const tasks = await getProjectTasks(projectId);
    const hasRunnable = tasks.some((task) => RUNNABLE_TASK_STATUSES.includes(task.status));
    if (!hasRunnable) break;

    const cycleResults = await runProjectCycle(projectId, cycleLimit);
    allResults.push(...cycleResults);
    // runProjectCycle 没有可执行任务时返回空数组，防止空转死循环。
    if (!cycleResults.length) break;
  }

  await syncProjectState(projectId);
  return allResults;
}

export async function getProjectDetail(projectId: string): Promise<ProjectDetailPayload> {
  await syncProjectState(projectId);
  const [projectRows, tasks, agents, deliverables, projectLogs, taskLogs, agentRuns, modelRuns, skillRuns, qualityReviews] =
    await Promise.all([
      readCollection<AnyRow>("projects"),
      readCollection<AnyRow>("tasks"),
      readCollection<AnyRow>("agents"),
      readCollection<Deliverable>("deliverables"),
      readCollection<ProjectLog>("project-logs"),
      readCollection<AnyRow>("task-logs"),
      readCollection<AnyRow>("agent-runs"),
      readCollection<AnyRow>("model-runs"),
      readCollection<SkillRun>("skill-runs"),
      readCollection<QualityReview>("quality-reviews")
    ]);
  const project = projectRows.find((item) => item.id === projectId);
  if (!project) throw new Error("project not found");

  const projectTasks = tasks.filter((task) => task.project_id === projectId).map(normalizeTaskRow);
  const projectAgentIds = new Set(projectTasks.map((task) => task.assignedAgentId).filter(Boolean));
  const participatingAgents = agents
    .filter((agent) => projectAgentIds.has(agent.id))
    .map((agent) => {
      const currentTask =
        projectTasks.find(
          (task) =>
            task.assignedAgentId === agent.id &&
            ["in_progress", "todo", "review", "waiting_boss_approval"].includes(task.status)
        ) ?? null;
      const latestOutput =
        [...projectTasks]
          .flatMap((task) => task.outputs.map((output) => ({ ...output, taskId: task.id })))
          .filter((output) => output.agentId === agent.id)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
      return {
        agent: normalizeAgentRow(agent),
        currentTask,
        recentOutput: latestOutput?.content ?? null
      };
    });

  return {
    project: normalizeProjectRow(project),
    tasks: projectTasks,
    agents: agents.filter((agent) => projectAgentIds.has(agent.id)).map(normalizeAgentRow),
    deliverables: deliverables
      .map(normalizeDeliverableRow)
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    projectLogs: projectLogs
      .map(normalizeProjectLogRow)
      .filter((item) => item.projectId === projectId)
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    taskLogs: taskLogs
      .filter((log) => projectTasks.some((task) => task.id === log.task_id))
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at))),
    agentRuns: agentRuns.filter((row) => projectTasks.some((task) => task.id === row.task_id)),
    modelRuns: modelRuns.filter((row) => projectTasks.some((task) => task.id === row.task_id)),
    skillRuns: skillRuns.filter((row) =>
      projectTasks.some((task) => task.id === ((row as AnyRow).task_id ?? (row as AnyRow).taskId))
    ),
    qualityReviews: qualityReviews
      .map(normalizeQualityReviewRow)
      .filter((row) => projectTasks.some((task) => task.id === row.taskId)),
    metrics: {
      total: projectTasks.length,
      done: projectTasks.filter((task) => task.status === "done").length,
      inProgress: projectTasks.filter((task) => task.status === "in_progress").length,
      review: projectTasks.filter((task) => task.status === "review").length,
      blocked: projectTasks.filter((task) => task.status === "blocked").length,
      waitingBossApproval: projectTasks.filter((task) => task.approvalStatus === "pending").length
    },
    participatingAgents,
    highRiskTasks: projectTasks.filter((task) => ["high", "critical"].includes(task.riskLevel)),
    blockedTasks: projectTasks.filter((task) => task.status === "blocked"),
    pendingApprovalTasks: projectTasks.filter((task) => task.approvalStatus === "pending")
  };
}

export async function getOwnerInbox() {
  const [tasks, deliverables, projects] = await Promise.all([
    readCollection<AnyRow>("tasks"),
    readCollection<Deliverable>("deliverables"),
    readCollection<AnyRow>("projects")
  ]);
  const normalizedTasks = tasks.map(normalizeTaskRow);
  const normalizedDeliverables = deliverables.map(normalizeDeliverableRow);
  const today = new Date().toISOString().slice(0, 10);

  return {
    pendingApprovals: normalizedTasks.filter((task) => task.approvalStatus === "pending"),
    blockedTasks: normalizedTasks.filter((task) => task.status === "blocked"),
    todayDone: normalizedTasks.filter(
      (task) => task.status === "done" && String((task as AnyRow).updatedAt ?? (task as AnyRow).updated_at ?? "").startsWith(today)
    ),
    recentDeliverables: normalizedDeliverables
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, 8)
      .map((item) => ({
        ...item,
        projectName: projects.find((project) => project.id === item.projectId)?.name ?? item.projectId
      })),
    highRiskItems: normalizedTasks.filter((task) => ["high", "critical"].includes(task.riskLevel))
  };
}

export async function syncProjectState(projectId: string | null | undefined) {
  if (!projectId) return null;
  const [projects, tasks] = await Promise.all([
    readCollection<AnyRow>("projects"),
    readCollection<AnyRow>("tasks")
  ]);
  const project = projects.find((item) => item.id === projectId);
  if (!project) return null;
  const projectTasks = tasks.filter((task) => task.project_id === projectId);
  const progress = calculateProjectProgress(projectTasks);
  const riskLevel = calculateProjectRisk(projectTasks);
  const stage = deriveProjectStage(projectTasks);
  const agentIds = Array.from(
    new Set(projectTasks.map((task) => task.assigned_agent_id).filter(Boolean))
  );

  return patchCollectionItem<any>("projects", projectId, {
    progress,
    risk_level: riskLevel,
    stage,
    agent_ids: agentIds,
    updated_at: new Date().toISOString()
  });
}

export async function appendProjectLog(input: {
  projectId: string;
  eventType: ProjectLogEventType;
  title: string;
  description: string;
  relatedTaskId?: string | null;
  relatedAgentId?: string | null;
  relatedDeliverableId?: string | null;
}) {
  if (!input.projectId) return null;
  return appendCollectionItem("project-logs", {
    id: crypto.randomUUID(),
    project_id: input.projectId,
    event_type: input.eventType,
    title: input.title,
    description: input.description,
    related_task_id: input.relatedTaskId ?? null,
    related_agent_id: input.relatedAgentId ?? null,
    related_deliverable_id: input.relatedDeliverableId ?? null,
    created_at: new Date().toISOString()
  });
}

export function calculateProjectProgress(tasks: AnyRow[]) {
  if (!tasks.length) return 0;
  const sum = tasks.reduce((total, task) => total + (STATUS_PROGRESS[task.status ?? task.board_status ?? "backlog"] ?? 0), 0);
  return Math.round(sum / tasks.length);
}

function calculateProjectRisk(tasks: AnyRow[]): Project["riskLevel"] {
  if (tasks.some((task) => task.risk_level === "critical")) return "critical";
  if (tasks.some((task) => task.risk_level === "high")) return "high";
  if (tasks.some((task) => task.risk_level === "medium")) return "medium";
  return "low";
}

function deriveProjectStage(tasks: AnyRow[]) {
  if (!tasks.length) return "planning";
  if (tasks.every((task) => task.status === "done")) return "done";
  if (tasks.some((task) => task.status === "review")) return "review";
  if (tasks.some((task) => task.status === "waiting_boss_approval")) return "approval";
  if (tasks.some((task) => task.status === "in_progress")) return "execution";
  return "planning";
}

async function createDeliverable(input: {
  project: AnyRow | null;
  task: AnyRow;
  agent: AnyRow;
  title: string;
  type: DeliverableType;
  content: string;
  status: DeliverableStatus;
}) {
  const now = new Date().toISOString();
  const projectSlug = slugify(input.project?.name ?? input.project?.id ?? "project");
  const safeTitle = slugify(input.title || input.task.title || "deliverable");
  const ext = DELIVERABLE_EXT[input.type] ?? "txt";
  const outputDir = path.join(process.cwd(), "outputs", projectSlug);
  await fs.mkdir(outputDir, { recursive: true });
  const fileName = `${safeTitle}-${Date.now()}.${ext}`;
  const filePath = path.join(outputDir, fileName);
  await fs.writeFile(filePath, input.content, "utf8");

  const deliverable: Deliverable = {
    id: crypto.randomUUID(),
    projectId: input.project?.id ?? input.task.project_id,
    taskId: input.task.id,
    agentId: input.agent.id,
    title: input.title,
    type: input.type,
    filePath,
    content: input.content,
    status: input.status,
    createdAt: now,
    updatedAt: now
  };
  await appendCollectionItem("deliverables", serializeDeliverable(deliverable));
  await appendProjectLog({
    projectId: deliverable.projectId,
    eventType: "deliverable_created",
    title: "交付物已生成",
    description: `${deliverable.title} 已写入 outputs/${projectSlug}`,
    relatedTaskId: deliverable.taskId ?? null,
    relatedAgentId: deliverable.agentId ?? null,
    relatedDeliverableId: deliverable.id
  });
  return deliverable;
}

async function generateProjectBrief(input: { goal: string; project: AnyRow | null }) {
  const fallback = buildFallbackBrief(input.goal, input.project);
  const llm = await runLLM({
    responseFormat: "json_object",
    messages: [
      {
        role: "system",
        content:
          "你是项目经理，请基于老板目标生成简洁的项目 brief。输出 JSON: {project_name, client_name, objective, client_profile, brief, risk_level, due_date}"
      },
      {
        role: "user",
        content: `老板目标：${input.goal}\n已有项目：${input.project?.name ?? "无"}`
      }
    ]
  });
  if (llm.status === "failed") return fallback;
  try {
    return { ...fallback, ...JSON.parse(extractJson(llm.content)) };
  } catch {
    return fallback;
  }
}

async function generateTaskPlan(input: {
  project: AnyRow;
  goal: string;
  agents: AnyRow[];
  skills: AnyRow[];
}): Promise<WorkflowTaskDraft[]> {
  const fallback = buildFallbackTaskPlan(input.goal, input.project, input.agents, input.skills);
  const llm = await runLLM({
    responseFormat: "json_object",
    messages: [
      {
        role: "system",
        content:
          "你是执行经理，请将目标拆成任务。输出 JSON: {tasks:[{title,description,assigned_agent_role,suggested_skills,model_policy,priority,risk_level,status,input_requirements,output_requirements,approval_required,task_type}]}"
      },
      {
        role: "user",
        content: [
          `项目：${input.project.name}`,
          `目标：${input.goal}`,
          `可用 Agent 角色：${Array.from(new Set(input.agents.map((agent) => agent.agent_role ?? "worker"))).join(", ")}`,
          `可用技能：${input.skills.filter((skill) => skill.enabled !== false).map((skill) => skill.slug).join(", ")}`
        ].join("\n")
      }
    ]
  });
  if (llm.status === "failed") return fallback;
  try {
    const parsed = JSON.parse(extractJson(llm.content));
    const rows = Array.isArray(parsed.tasks) ? parsed.tasks : [];
    return rows.length
      ? rows.map((row: AnyRow) => ({
          title: String(row.title),
          description: String(row.description),
          assigned_agent_role: String(row.assigned_agent_role ?? "worker"),
          suggested_skills: Array.isArray(row.suggested_skills)
            ? row.suggested_skills.map(String)
            : ["goal-breakdown"],
          model_policy: String(row.model_policy ?? "low_cost"),
          priority: normalizePriority(row.priority),
          risk_level: normalizeRisk(row.risk_level),
          status: normalizeTaskStatus(row.status),
          input_requirements: String(row.input_requirements ?? "明确输入材料"),
          output_requirements: String(row.output_requirements ?? "输出结构化结果"),
          approval_required: Boolean(row.approval_required),
          task_type: row.task_type ? String(row.task_type) : undefined
        }))
      : fallback;
  } catch {
    return fallback;
  }
}

function buildFallbackBrief(goal: string, project: AnyRow | null) {
  const title = project?.name ?? firstSentence(goal, 22);
  return {
    project_name: title,
    client_name: project?.client_name ?? "待确认客户",
    objective: goal,
    client_profile: project?.client_profile ?? "当前由老板直接发起，先以最小闭环方式推进。",
    brief: `围绕“${goal}”构建一个可执行项目闭环，先打通项目创建、任务拆解、执行、复核和交付物落地。`,
    risk_level: inferRiskFromText(goal),
    due_date: null
  };
}

function buildFallbackTaskPlan(goal: string, project: AnyRow, agents: AnyRow[], skills: AnyRow[]): WorkflowTaskDraft[] {
  const preferred = (slug: string, fallbackSlug: string) =>
    skills.some((skill) => skill.slug === slug && skill.enabled !== false) ? slug : fallbackSlug;
  const projectName = project.name ?? goal;
  const highRisk = /(发布|上线|投放|发信|合同|报价|付款|数据库|广告预算|wordpress)/i.test(goal);
  return [
    {
      title: `梳理 ${projectName} 的项目 Brief`,
      description: "整理目标、客户背景、边界、关键风险和交付标准，形成统一 brief。",
      assigned_agent_role: "leader",
      suggested_skills: [preferred("goal-breakdown", "content-planning")],
      model_policy: "strong_reasoning",
      priority: "urgent",
      risk_level: "medium",
      status: "todo",
      input_requirements: "老板目标、客户背景、现有约束",
      output_requirements: "可复用的项目 brief",
      approval_required: false,
      task_type: "general"
    },
    {
      title: `拆解 ${projectName} 执行任务并生成产出`,
      description: "按任务链路拆解执行步骤，安排负责人、技能和交付物格式，推进第一轮执行。",
      assigned_agent_role: "worker",
      suggested_skills: [preferred("implementation-planning", "goal-breakdown"), preferred("content-planning", "goal-breakdown")],
      model_policy: "coding",
      priority: "high",
      risk_level: highRisk ? "high" : "medium",
      status: "todo",
      input_requirements: "项目 brief、所需资料、参考样例",
      output_requirements: "执行结果、交付物草稿、风险备注",
      approval_required: highRisk,
      task_type: highRisk ? "automation" : "content"
    },
    {
      title: `复核 ${projectName} 第一轮结果`,
      description: "从质量、风险和交付可用性角度复核当前结果，决定通过、返工或请老板审批。",
      assigned_agent_role: "reviewer",
      suggested_skills: [preferred("review-gate", "goal-breakdown")],
      model_policy: "review_policy",
      priority: "high",
      risk_level: highRisk ? "high" : "medium",
      status: "todo",
      input_requirements: "任务产出、交付物、风险说明",
      output_requirements: "审核结论、整改建议、是否需老板审批",
      approval_required: highRisk,
      task_type: "review"
    }
  ];
}

function resolveTaskSkills(task: AnyRow, assignments: AnyRow[], skills: AnyRow[]): AnyRow[] {
  const suggested = new Set<string>(task.suggested_skills ?? []);
  const byAssignments = assignments
    .map((assignment) => {
      const skillId = assignment.skill_id ?? assignment.skillId;
      return skills.find((skill) => skill.id === skillId && skill.enabled !== false) ?? null;
    })
    .filter(Boolean) as AnyRow[];

  const bySuggested = skills.filter((skill) => suggested.has(skill.slug) && skill.enabled !== false);
  const combined = [...bySuggested, ...byAssignments];
  return combined.filter((item, index) => combined.findIndex((entry) => entry.id === item.id) === index).slice(0, 4);
}

function parseAgentResponse(
  content: string,
  task: AnyRow,
  project: AnyRow | null,
  agent: AnyRow,
  skills: AnyRow[]
) {
  const fallback = {
    summary: `${agent.name} 已完成 ${task.title} 的首轮执行。`,
    result: [
      `项目：${project?.name ?? "未命名项目"}`,
      `任务：${task.title}`,
      `执行员工：${agent.name}`,
      `执行摘要：已根据任务说明完成第一轮处理，并整理为可复核结果。`,
      `技能参与：${skills.map((skill) => skill.name).join("、") || "无"}`
    ].join("\n"),
    deliverables: [
      {
        title: `${task.title} 交付草稿`,
        type: inferDeliverableType(task.task_type),
        content: `# ${task.title}\n\n${task.description}\n\n这是系统根据任务要求生成的首轮交付草稿。`
      }
    ],
    risk_notes: task.risk_level === "high" || task.risk_level === "critical" ? "涉及高风险事项，建议老板审批。" : "无显著新增风险。",
    review_notes: "建议进入 Review Gate。"
  };
  if (!content) return fallback;
  try {
    const parsed = JSON.parse(extractJson(content));
    return {
      ...fallback,
      ...parsed,
      deliverables: Array.isArray(parsed.deliverables) && parsed.deliverables.length ? parsed.deliverables : fallback.deliverables
    };
  } catch {
    return {
      ...fallback,
      result: content
    };
  }
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function extractJson(text: string) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("No JSON found");
  return text.slice(start, end + 1);
}

function normalizePriority(value: unknown): Task["priority"] {
  return ["low", "medium", "high", "urgent"].includes(String(value)) ? (value as Task["priority"]) : "medium";
}

function normalizeRisk(value: unknown): Task["riskLevel"] {
  return ["low", "medium", "high", "critical"].includes(String(value)) ? (value as Task["riskLevel"]) : "medium";
}

function normalizeTaskStatus(value: unknown): Task["status"] {
  return ["backlog", "todo", "in_progress", "review", "blocked", "waiting_boss_approval", "done", "cancelled"].includes(String(value))
    ? (value as Task["status"])
    : "todo";
}

function pickAgentForRole(role: string, agents: AnyRow[], skills: string[]) {
  const byRole = agents.find((agent) => (agent.agent_role ?? "worker") === role);
  if (byRole) return byRole;
  const bySkill = agents.find((agent) => (agent.skills ?? []).some((skill: string) => skills.includes(skill)));
  return bySkill ?? agents[0] ?? null;
}

function normalizeTaskType(skillSlug?: string) {
  if (!skillSlug) return "general";
  if (skillSlug.includes("review")) return "review";
  if (skillSlug.includes("automation")) return "automation";
  if (skillSlug.includes("content")) return "content";
  if (skillSlug.includes("implementation") || skillSlug.includes("code")) return "code";
  return "general";
}

function meetingAgentProfile(agent: AnyRow) {
  return {
    id: String(agent.id),
    name: String(agent.name ?? "Agent"),
    title: String(agent.title ?? ""),
    department: String(agent.department ?? ""),
    role: String(agent.agent_role ?? agent.agentRole ?? "worker"),
    responsibilities: String(agent.prompt ?? "").slice(0, 800),
    skills: Array.isArray(agent.skills) ? agent.skills : []
  };
}

function fallbackMeetingContribution(agent: AnyRow, topic: string) {
  const role = String(agent.agent_role ?? agent.agentRole ?? "worker");
  const department = String(agent.department ?? "").toLowerCase();
  if (role === "reviewer" || department === "finance" || department === "legal") {
    return `围绕“${topic}”，我会先检查预算、承诺、合规边界和 L0–L3 审批条件，再给出可执行范围。`;
  }
  if (role === "leader") {
    return `围绕“${topic}”，建议先明确目标、验收标准、任务依赖和负责人，再按风险等级安排执行顺序。`;
  }
  return `围绕“${topic}”，我会从 ${agent.title ?? agent.department ?? "执行岗位"} 视角拆出交付物、所需输入和下一步动作。`;
}

function isExternalActionSkill(skill: AnyRow) {
  return classifyApproval(skill).level !== "L0";
}

function inferDeliverableType(taskType?: string): DeliverableType {
  if (taskType === "code") return "json";
  if (taskType === "automation") return "report";
  if (taskType === "review") return "report";
  if (taskType === "content") return "markdown";
  return "markdown";
}

function inferRiskFromText(text: string): Project["riskLevel"] {
  if (/(合同|报价|付款|法务|发布|上线|数据库|广告预算)/i.test(text)) return "high";
  if (/(执行|交付|自动)/i.test(text)) return "medium";
  return "low";
}

function firstSentence(text: string, maxLength: number) {
  return text.replace(/\s+/g, " ").trim().slice(0, maxLength) || "新项目";
}

function sortTasksForExecution(left: Task, right: Task) {
  const stageWeight = (task: Task) =>
    task.status === "todo" ? 3 : task.status === "in_progress" ? 2 : task.status === "review" ? 1 : 0;
  return (
    stageWeight(right) - stageWeight(left) ||
    PRIORITY_WEIGHT[right.priority] - PRIORITY_WEIGHT[left.priority] ||
    left.title.localeCompare(right.title)
  );
}

function serializeDeliverable(deliverable: Deliverable) {
  return {
    id: deliverable.id,
    project_id: deliverable.projectId,
    task_id: deliverable.taskId ?? null,
    agent_id: deliverable.agentId ?? null,
    title: deliverable.title,
    type: deliverable.type,
    file_path: deliverable.filePath ?? null,
    content: deliverable.content ?? null,
    status: deliverable.status,
    created_at: deliverable.createdAt,
    updated_at: deliverable.updatedAt
  };
}

function normalizeTaskRow(row: AnyRow): Task {
  return {
    id: row.id,
    title: coerceText(row.title),
    description: coerceText(row.description),
    taskType: row.task_type ?? row.taskType ?? "general",
    suggestedSkills: row.suggested_skills ?? row.suggestedSkills ?? [],
    clientName: row.client_name ?? row.clientName ?? null,
    projectId: row.project_id ?? row.projectId ?? null,
    assignedAgentId: row.assigned_agent_id ?? row.assignedAgentId ?? null,
    assignedAgentRole: row.assigned_agent_role ?? row.assignedAgentRole ?? null,
    priority: row.priority ?? "medium",
    riskLevel: row.risk_level ?? row.riskLevel ?? "low",
    dueAt: row.due_at ?? row.dueAt ?? null,
    status: row.status ?? "todo",
    boardStatus: row.board_status ?? row.boardStatus ?? row.status ?? "todo",
    approvalStatus: row.approval_status ?? row.approvalStatus ?? "not_required",
    approvalLevel: row.approval_level ?? row.approvalLevel ?? "L0",
    approvalRequired: Boolean(row.approval_required ?? row.approvalRequired ?? false),
    reviewStatus: row.review_status ?? row.reviewStatus ?? "not_required",
    modelPolicy: row.model_policy ?? row.modelPolicy ?? null,
    inputRequirements: row.input_requirements ?? row.inputRequirements ?? null,
    outputRequirements: row.output_requirements ?? row.outputRequirements ?? null,
    result: row.result === null || row.result === undefined ? null : coerceText(row.result),
    estimatedCost: Number(row.estimated_cost ?? row.estimatedCost ?? 0),
    actualCost: Number(row.actual_cost ?? row.actualCost ?? 0),
    parentTaskId: row.parent_task_id ?? row.parentTaskId ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    usedMemoryIds: row.used_memory_ids ?? row.usedMemoryIds ?? [],
    modelRun: row.model_run ?? row.modelRun ?? null,
    reworkCount: Number(row.rework_count ?? row.reworkCount ?? 0),
    outputs: row.outputs ?? []
  };
}

function normalizeAgentRow(row: AnyRow): Agent {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    title: row.title,
    managerId: row.manager_id ?? row.managerId ?? null,
    model: row.model,
    prompt: row.prompt,
    toolPermissions: row.tool_permissions ?? row.toolPermissions ?? [],
    status: row.status ?? "idle",
    agentRole: row.agent_role ?? row.agentRole ?? "worker",
    skills: row.skills ?? [],
    workload: Number(row.workload ?? 0),
    modelPolicyId: row.model_policy_id ?? row.modelPolicyId ?? null,
    preferredModelPolicy: row.preferred_model_policy ?? row.preferredModelPolicy ?? null,
    preferredProvider: row.preferred_provider ?? row.preferredProvider ?? null,
    preferredModel: row.preferred_model ?? row.preferredModel ?? null,
    fallbackProvider: row.fallback_provider ?? row.fallbackProvider ?? null,
    fallbackModel: row.fallback_model ?? row.fallbackModel ?? null,
    maxCostPerRun: row.max_cost_per_run ?? row.maxCostPerRun ?? null,
    temperature: row.temperature ?? null,
    maxTokens: row.max_tokens ?? row.maxTokens ?? null,
    currentFocus: row.current_focus ?? row.currentFocus ?? "",
    successRate: Number(row.success_rate ?? row.successRate ?? 0)
  };
}

// 模型偶尔会把字符串字段输出成嵌套对象，渲染前压平成可读文本，避免前端崩溃。
function coerceText(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map((item) => coerceText(item)).filter(Boolean).join("\n");
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, val]) => `${key}：${coerceText(val)}`)
      .join("\n");
  }
  return String(value);
}

function normalizeProjectRow(row: AnyRow): Project {
  return {
    id: row.id,
    name: coerceText(row.name),
    clientName: coerceText(row.client_name ?? row.clientName ?? ""),
    objective: coerceText(row.objective),
    clientProfile: coerceText(row.client_profile ?? row.clientProfile ?? ""),
    brief: row.brief === null || row.brief === undefined ? null : coerceText(row.brief),
    progress: Number(row.progress ?? 0),
    stage: row.stage ?? "planning",
    riskLevel: row.risk_level ?? row.riskLevel ?? "low",
    agentIds: row.agent_ids ?? row.agentIds ?? [],
    dueDate: row.due_date ?? row.dueDate
  };
}

function normalizeDeliverableRow(row: AnyRow): Deliverable {
  return {
    id: row.id,
    projectId: row.projectId ?? row.project_id,
    taskId: row.taskId ?? row.task_id ?? null,
    agentId: row.agentId ?? row.agent_id ?? null,
    title: row.title,
    type: row.type,
    filePath: row.filePath ?? row.file_path ?? null,
    content: row.content ?? null,
    status: row.status,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString()
  };
}

function normalizeProjectLogRow(row: AnyRow): ProjectLog {
  return {
    id: row.id,
    projectId: row.projectId ?? row.project_id,
    eventType: row.eventType ?? row.event_type,
    title: row.title,
    description: row.description,
    relatedTaskId: row.relatedTaskId ?? row.related_task_id ?? null,
    relatedAgentId: row.relatedAgentId ?? row.related_agent_id ?? null,
    relatedDeliverableId: row.relatedDeliverableId ?? row.related_deliverable_id ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString()
  };
}

function normalizeQualityReviewRow(row: AnyRow): QualityReview {
  return {
    id: row.id,
    taskId: row.taskId ?? row.task_id,
    reviewerAgentId: row.reviewerAgentId ?? row.reviewer_agent_id ?? null,
    status: row.status ?? "pending",
    score: row.score ?? null,
    checklist: row.checklist ?? [],
    notes: row.notes ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    decidedAt: row.decidedAt ?? row.decided_at ?? null
  };
}

async function getProjectTasks(projectId: string) {
  const tasks = await readCollection<AnyRow>("tasks");
  return tasks.filter((task) => task.project_id === projectId).map(normalizeTaskRow);
}

async function readProject(projectId: string) {
  const projects = await readCollection<AnyRow>("projects");
  const project = projects.find((item) => item.id === projectId);
  return project ? normalizeProjectRow(project) : null;
}
