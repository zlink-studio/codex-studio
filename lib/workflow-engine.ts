import { promises as fs } from "fs";
import path from "path";
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
};

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
    const now = new Date().toISOString();
    const approvalRequired =
      draft.approval_required || draft.risk_level === "high" || draft.risk_level === "critical";
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
      status: approvalRequired ? "waiting_boss_approval" : draft.status,
      board_status: approvalRequired ? "waiting_boss_approval" : draft.status,
      approval_status: approvalRequired ? "pending" : "not_required",
      approval_required: approvalRequired,
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
    createdTasks.push(task);
    if (assignedAgent?.id) suggestedAgents.add(assignedAgent.id);
    if (approvalRequired) {
      risks.add(`${task.title} 需要老板审批`);
      await appendCollectionItem("approvals", {
        id: crypto.randomUUID(),
        task_id: task.id,
        status: "pending",
        decision_note: "任务涉及高风险或 action skill，等待老板审批。",
        created_at: now,
        decided_at: null
      });
      await appendProjectLog({
        projectId: input.project.id,
        eventType: "boss_approval_required",
        title: "任务等待老板审批",
        description: `${task.title} 涉及高风险或 action skill，已挂起。`,
        relatedTaskId: task.id,
        relatedAgentId: assignedAgent?.id ?? null
      });
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
    nextAction: createdTasks.some((task) => task.approval_status === "pending")
      ? "先审批高风险任务，再执行下一轮。"
      : "可以直接运行下一条任务。"
  };
}

export async function executeAgentRun(taskId: string, preferredAgentId?: string | null): Promise<AgentRunExecutionResult> {
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

  const llmResult = await runLLM({
    provider: selectedPolicy.primaryProvider,
    model: selectedPolicy.primaryModel,
    temperature: selectedPolicy.temperature,
    maxTokens: selectedPolicy.maxTokens,
    responseFormat: "json_object",
    metadata: {
      task_id: task.id,
      project_id: project?.id ?? null,
      policy: selectedPolicy.name
    },
    messages: [
      {
        role: "system",
        content:
          "你是项目执行员工。请严格输出 JSON，对任务给出结果、交付物内容、风险说明和下一状态建议。不要执行任何外部动作。"
      },
      {
        role: "user",
        content: [
          `项目：${project?.name ?? "未命名项目"}`,
          `Project Brief：${project?.brief ?? project?.objective ?? ""}`,
          `任务标题：${task.title}`,
          `任务描述：${task.description}`,
          `输入要求：${task.input_requirements ?? "无"}`,
          `输出要求：${task.output_requirements ?? "无"}`,
          `技能：${selectedSkillRows.map((item) => item.slug).join(", ") || "无"}`,
          `记忆：\n${memoryText}`,
          '请输出 JSON: {"summary":"","result":"","deliverables":[{"title":"","type":"markdown","content":"","is_file":true}],"risk_notes":"","needs_boss_approval":false,"review_notes":""}'
        ].join("\n\n")
      }
    ]
  });

  const parsed = parseAgentResponse(llmResult.content, task, project, assignedAgent, selectedSkillRows);
  const hasActionSkill = selectedSkillRows.some((skill) => skill.skill_type === "action");
  const requiresBossApproval =
    hasActionSkill ||
    task.risk_level === "high" ||
    task.risk_level === "critical" ||
    Boolean(task.approval_required);

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
    const pendingApproval = skill.skill_type === "action" || !approved;
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
      status: requiresBossApproval ? "review" : "draft"
    });
    deliverables.push(deliverable);
  }

  const nextStatus = requiresBossApproval ? "waiting_boss_approval" : "review";
  const nextApproval = requiresBossApproval ? "pending" : "not_required";
  const taskPatch = {
    assigned_agent_id: assignedAgent.id,
    model_policy: selectedPolicy.name,
    result: parsed.result,
    outputs: [...(task.outputs ?? []), taskOutput],
    status: nextStatus,
    board_status: nextStatus,
    approval_status: nextApproval,
    review_status: requiresBossApproval ? "not_required" : "pending",
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

  if (requiresBossApproval) {
    await ensurePendingApproval(task.id);
    await appendCollectionItem("task-logs", {
      id: crypto.randomUUID(),
      task_id: task.id,
      agent_id: assignedAgent.id,
      run_id: agentRun.id,
      type: "approval",
      content: "本轮执行涉及高风险或 action skill，已转入老板审批。",
      metadata: {
        deliverable_ids: deliverables.map((item) => item.id)
      },
      created_at: finishedAt
    });
    if (project?.id) {
      await appendProjectLog({
        projectId: project.id,
        eventType: "boss_approval_required",
        title: "等待老板审批",
        description: `${task.title} 已生成结果，但需要老板确认后才能继续。`,
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

  return {
    task: updatedTask,
    project: project?.id ? await readProject(project.id) : null,
    agentRun: updatedAgentRun ?? agentRun,
    modelRun,
    skillRuns: skillRunRows,
    log: resultLog,
    deliverables,
    warning: hasActionSkill
      ? "本次命中了 action skill，系统仅生成建议和交付物草稿，不会自动执行外部动作。"
      : undefined
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

async function ensurePendingApproval(taskId: string) {
  const approvals = await readCollection<AnyRow>("approvals");
  const existing = approvals.find((item) => item.task_id === taskId && item.status === "pending");
  if (existing) return existing;
  return appendCollectionItem("approvals", {
    id: crypto.randomUUID(),
    task_id: taskId,
    status: "pending",
    decision_note: "等待老板审批后继续。",
    created_at: new Date().toISOString(),
    decided_at: null
  });
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
    title: row.title,
    description: row.description,
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
    approvalRequired: Boolean(row.approval_required ?? row.approvalRequired ?? false),
    reviewStatus: row.review_status ?? row.reviewStatus ?? "not_required",
    modelPolicy: row.model_policy ?? row.modelPolicy ?? null,
    inputRequirements: row.input_requirements ?? row.inputRequirements ?? null,
    outputRequirements: row.output_requirements ?? row.outputRequirements ?? null,
    result: row.result ?? null,
    estimatedCost: Number(row.estimated_cost ?? row.estimatedCost ?? 0),
    actualCost: Number(row.actual_cost ?? row.actualCost ?? 0),
    parentTaskId: row.parent_task_id ?? row.parentTaskId ?? null,
    sortOrder: Number(row.sort_order ?? row.sortOrder ?? 0),
    usedMemoryIds: row.used_memory_ids ?? row.usedMemoryIds ?? [],
    modelRun: row.model_run ?? row.modelRun ?? null,
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

function normalizeProjectRow(row: AnyRow): Project {
  return {
    id: row.id,
    name: row.name,
    clientName: row.client_name ?? row.clientName ?? "",
    objective: row.objective,
    clientProfile: row.client_profile ?? row.clientProfile ?? "",
    brief: row.brief ?? null,
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
