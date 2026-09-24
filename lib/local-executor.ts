import { assertTaskExecutionAllowed, classifyApproval } from "@/lib/approval-policy";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

type TaskRow = {
  id: string;
  title: string;
  description: string;
  taskType?: string;
  task_type?: string;
  suggestedSkills?: string[];
  suggested_skills?: string[];
  assignedAgentId?: string | null;
  assigned_agent_id?: string | null;
  riskLevel?: string;
  risk_level?: string;
  status?: string;
  boardStatus?: string;
  board_status?: string;
  reviewStatus?: string;
  review_status?: string;
  approvalStatus?: string;
  approval_status?: string;
  approvalLevel?: string;
  approval_level?: string;
  outputs?: Array<{ agentId: string; content: string; createdAt: string }>;
};

type AgentRow = {
  id: string;
  name: string;
  title?: string;
  department?: string;
};

type AgentSkillRow = {
  id: string;
  agent_id?: string;
  agentId?: string;
  skill_id?: string;
  skillId?: string;
  priority?: "primary" | "secondary" | "optional";
  enabled?: boolean;
};

type SkillRow = {
  id: string;
  name: string;
  slug: string;
  category?: string;
  risk_level?: string;
  skill_type?: string;
  approval_level?: string;
  approval_required?: boolean;
  description?: string;
  instructions?: string;
  enabled?: boolean;
};

type SkillReviewRow = {
  id: string;
  skill_id?: string;
  skillId?: string;
  review_status?: string;
  reviewStatus?: string;
};

export async function executeTaskById(taskId: string, preferredAgentId?: string | null) {
  const taskRows = await readCollection<TaskRow>("tasks");
  const task = taskRows.find((item) => item.id === taskId);
  if (!task) throw new Error("Task not found");

  if ((task.approval_status ?? task.approvalStatus) === "pending") {
    throw new Error("This task is waiting for owner approval and cannot be executed yet.");
  }
  if ((task.approval_status ?? task.approvalStatus) === "rejected") {
    throw new Error("This task was rejected and cannot be executed.");
  }
  if ((task.board_status ?? task.boardStatus) === "done" || task.status === "done") {
    throw new Error("This task is already done.");
  }

  const [agents, agentSkills, skills, skillReviews] = await Promise.all([
    readCollection<AgentRow>("agents"),
    readCollection<AgentSkillRow>("agent-skills"),
    readCollection<SkillRow>("skills"),
    readCollection<SkillReviewRow>("skill-reviews")
  ]);

  const agentId = preferredAgentId ?? task.assigned_agent_id ?? task.assignedAgentId;
  const agent = agents.find((item) => item.id === agentId) ?? agents[0];
  if (!agent) throw new Error("No agent available");

  const startedAt = new Date().toISOString();
  const selectedSkills = selectSkillsForTask(task, agent.id, agentSkills, skills);
  const approvalDecision = assertTaskExecutionAllowed(
    task as unknown as Record<string, unknown>,
    selectedSkills as Array<Record<string, unknown>>
  );
  const executedSkillRuns = buildSkillRuns(task, agent, selectedSkills, skillReviews, startedAt);
  const approvedSkills = executedSkillRuns.filter((item) => item.status === "success");
  const gatedSkills = executedSkillRuns.filter((item) => item.status === "pending_approval");
  const output = buildExecutionOutput(task, agent, approvedSkills, gatedSkills);
  const finishedAt = new Date().toISOString();

  const agentRun = {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: agent.id,
    status: "succeeded",
    model: "local-executor",
    input: {
      task_id: task.id,
      task_title: task.title,
      risk_level: task.risk_level ?? task.riskLevel ?? "low",
      selected_skill_ids: selectedSkills.map((item) => item.id)
    },
    output: {
      content: output,
      applied_skills: approvedSkills.map((item) => item.skill_name),
      gated_skills: gatedSkills.map((item) => item.skill_name)
    },
    prompt_tokens: 0,
    completion_tokens: 0,
    cost: 0,
    error: null,
    started_at: startedAt,
    finished_at: finishedAt,
    created_at: startedAt
  };

  const modelRun = {
    id: crypto.randomUUID(),
    agent_run_id: agentRun.id,
    task_id: task.id,
    agent_id: agent.id,
    provider: "local",
    model: "rule-based-executor",
    input_tokens: 0,
    output_tokens: 0,
    estimated_cost: 0,
    latency_ms: 0,
    status: "success",
    error: null,
    created_at: finishedAt
  };

  const nextOutput = {
    agentId: agent.id,
    content: output,
    createdAt: finishedAt
  };

  const updatedTask = await patchCollectionItem<TaskRow>("tasks", task.id, {
    outputs: [...(task.outputs ?? []), nextOutput],
    status: "review",
    board_status: "review",
    review_status: "pending",
    approval_level: approvalDecision.level,
    updated_at: finishedAt
  } as Partial<TaskRow>);

  await appendCollectionItem("agent-runs", agentRun);
  await appendCollectionItem("model-runs", modelRun);
  for (const item of executedSkillRuns) {
    await appendCollectionItem("skill-runs", item);
  }

  const thinkingLog = {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: agent.id,
    run_id: agentRun.id,
    type: "thinking",
    content: `${agent.name} 已开始执行任务，并自动挂载了 ${selectedSkills.length} 个技能。`,
    metadata: {
      stage: "started",
      source: "local_executor",
      selected_skill_ids: selectedSkills.map((item) => item.id)
    },
    created_at: startedAt
  };

  const resultLog = {
    id: crypto.randomUUID(),
    task_id: task.id,
    agent_id: agent.id,
    run_id: agentRun.id,
    type: "result",
    content: output,
    metadata: {
      stage: "completed",
      source: "local_executor",
      model_run_id: modelRun.id,
      applied_skills: approvedSkills.map((item) => item.skill_name),
      gated_skills: gatedSkills.map((item) => item.skill_name),
      skill_run_ids: executedSkillRuns.map((item) => item.id)
    },
    created_at: finishedAt
  };

  await appendCollectionItem("task-logs", resultLog);
  await appendCollectionItem("task-logs", thinkingLog);

  const reviews = await readCollection<Array<Record<string, unknown>>[number]>("quality-reviews");
  const existingReview = reviews.find((item) => item.task_id === task.id);
  if (!existingReview) {
    await appendCollectionItem("quality-reviews", {
      id: crypto.randomUUID(),
      task_id: task.id,
      reviewer_agent_id: agent.id,
      status: "pending",
      score: null,
      checklist: [
        { label: "是否完成任务目标", passed: true },
        { label: "是否清楚列出执行范围与风险", passed: true },
        { label: "是否可以进入复核", passed: true }
      ],
      notes: "员工已提交首轮结果，等待负责人或 Review Gate 复核。",
      created_at: finishedAt,
      decided_at: null
    });
  }

  return {
    persisted: true,
    task: updatedTask,
    agentRun,
    modelRun,
    log: resultLog,
    skillRuns: executedSkillRuns,
    warning: gatedSkills.length ? "部分高风险技能已被拦截，需在审批通过后继续。" : undefined
  };
}

function selectSkillsForTask(task: TaskRow, agentId: string, agentSkills: AgentSkillRow[], skills: SkillRow[]) {
  const enabledAssignments = agentSkills
    .filter((item) => (item.agent_id ?? item.agentId) === agentId && item.enabled !== false)
    .sort((left, right) => priorityWeight(left.priority) - priorityWeight(right.priority));

  const mapped = enabledAssignments
    .map((assignment) => {
      const skill = skills.find((item) => item.id === (assignment.skill_id ?? assignment.skillId) && item.enabled !== false);
      return skill ? { ...skill, assignment_priority: assignment.priority ?? "secondary" } : null;
    })
    .filter(Boolean) as Array<SkillRow & { assignment_priority: string }>;

  const suggested = new Set(task.suggested_skills ?? task.suggestedSkills ?? []);
  const exactMatches = mapped.filter((item) => suggested.has(item.slug));
  const sameCategoryMatches = mapped.filter((item) => item.category === normalizeTaskCategory(task.task_type ?? task.taskType));
  const fallback = mapped.slice(0, 3);

  const combined = [...exactMatches, ...sameCategoryMatches, ...fallback];
  const unique = combined.filter((item, index, array) => array.findIndex((entry) => entry.id === item.id) === index);
  return unique.slice(0, 3);
}

function buildSkillRuns(
  task: TaskRow,
  agent: AgentRow,
  selectedSkills: Array<SkillRow & { assignment_priority?: string }>,
  skillReviews: SkillReviewRow[],
  createdAt: string
) {
  return selectedSkills.map((skill) => {
    const review = skillReviews.find((item) => (item.skill_id ?? item.skillId) === skill.id);
    const approved = !skill.approval_required || (review?.review_status ?? review?.reviewStatus) === "approved";
    const decision = classifyApproval(skill as unknown as Record<string, unknown>);
    const taskApprovalStatus = task.approval_status ?? task.approvalStatus ?? "not_required";
    const policyAllows = decision.level !== "L3" && (decision.level !== "L2" || taskApprovalStatus === "approved");
    const status = approved && policyAllows ? "success" : "pending_approval";

    return {
      id: crypto.randomUUID(),
      skill_id: skill.id,
      agent_id: agent.id,
      task_id: task.id,
      agent_run_id: null,
      model_run_id: null,
      status,
      input: {
        task_title: task.title,
        task_type: task.task_type ?? task.taskType ?? "general",
        risk_level: task.risk_level ?? task.riskLevel ?? "low",
        assignment_priority: skill.assignment_priority ?? "secondary"
      },
      output: approved
        ? {
            summary: buildSkillContribution(skill, task),
            skill_name: skill.name
          }
        : null,
      error: approved ? null : "该技能属于高风险能力，尚未审批通过。",
      latency_ms: Math.floor(Math.random() * 400) + 120,
      created_at: createdAt,
      skill_name: skill.name
    };
  });
}

function buildExecutionOutput(
  task: TaskRow,
  agent: AgentRow,
  approvedSkills: Array<Record<string, unknown>>,
  gatedSkills: Array<Record<string, unknown>>
) {
  const riskLabel = task.risk_level ?? task.riskLevel ?? "low";
  const typeLabel = task.task_type ?? task.taskType ?? "general";
  const enabledNames = approvedSkills.map((item) => String(item.skill_name));
  const gatedNames = gatedSkills.map((item) => String(item.skill_name));

  return [
    `执行员工：${agent.name}`,
    `岗位：${agent.title ?? agent.department ?? "通用执行"}`,
    `任务：${task.title}`,
    `任务类型：${typeLabel}`,
    `风险等级：${riskLabel}`,
    `本次启用技能：${enabledNames.length ? enabledNames.join("、") : "无"}`,
    gatedNames.length ? `被拦截技能：${gatedNames.join("、")}` : "被拦截技能：无",
    "",
    "本轮交付：",
    `1. 已根据任务说明整理首轮执行结果：${task.description}`,
    approvedSkills.length
      ? `2. 已调用 ${approvedSkills.length} 个已授权技能，补齐本轮任务的分析与交付结构。`
      : "2. 当前没有直接可用的已授权技能，先按任务目标生成基础执行结果。",
    gatedNames.length
      ? `3. 有 ${gatedNames.length} 个高风险技能被拦截，需要审批通过后继续。`
      : "3. 当前没有被拦截的高风险技能，可以直接进入复核。",
    "",
    "待确认事项：",
    "- 是否需要补充更细的执行清单",
    "- 是否需要补充客户、报价、合同或上线限制",
    "- 是否允许进入最终交付或继续返工"
  ].join("\n");
}

function buildSkillContribution(skill: SkillRow, task: TaskRow) {
  const category = skill.category ?? "general";
  if (category === "review") return `使用 ${skill.name} 对任务进行了复核结构准备。`;
  if (category === "automation") return `使用 ${skill.name} 补充了自动化链路与执行节点。`;
  if (category === "content") return `使用 ${skill.name} 为任务补充了内容结构与表达。`;
  if (category === "data") return `使用 ${skill.name} 补充了数据整理与校验建议。`;
  if (category === "code") return `使用 ${skill.name} 补充了实现步骤与技术动作。`;
  return `使用 ${skill.name} 为 ${task.title} 提供专项支持。`;
}

function normalizeTaskCategory(taskType?: string) {
  if (!taskType) return "management";
  if (taskType === "review" || taskType === "contract") return "review";
  if (taskType === "automation") return "automation";
  if (taskType === "content" || taskType === "social") return "content";
  if (taskType === "data" || taskType === "table") return "data";
  if (taskType === "code") return "code";
  return "management";
}

function priorityWeight(priority?: string) {
  if (priority === "primary") return 0;
  if (priority === "secondary") return 1;
  return 2;
}
