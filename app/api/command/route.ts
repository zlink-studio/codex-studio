import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { resolveModelPolicy, runLLM } from "@/lib/llm/router";
import { formatMemoriesForPrompt, proposeMemoryFromAgentRun, retrieveMemoryForCommand } from "@/lib/memory/service";
import { agents as fallbackAgents } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Agent, ApprovalStatus, RiskLevel, TaskPriority } from "@/lib/types";

type CommandBody = {
  goal?: string;
  owner_id?: string;
  ownerId?: string;
  project_id?: string | null;
  projectId?: string | null;
};

type CommandPlanTask = {
  title: string;
  description: string;
  taskType?: string;
  assignedAgentId?: string | null;
  agentRole?: string | null;
  priority?: TaskPriority;
  riskLevel?: RiskLevel;
  dueAt?: string | null;
};

type CommandPlanMemory = {
  title: string;
  content: string;
  summary?: string | null;
  type?: "company" | "client" | "project" | "agent" | "sop" | "review";
  scope?: "global" | "client" | "project" | "agent";
  tags?: string[];
  reason?: string;
  riskLevel?: RiskLevel;
};

type CommandPlan = {
  tasks: CommandPlanTask[];
  longTermMemories?: CommandPlanMemory[];
  summary?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<CommandBody>(request);
  if (!body?.goal) return fail("goal is required");

  const ownerId = resolveOwnerId(body);
  const projectId = body.project_id ?? body.projectId ?? null;
  const supabase = createSupabaseServerClient();
  const leaderAgent = await loadLeaderAgent(ownerId);
  const memories = await retrieveMemoryForCommand(body.goal, projectId, ownerId);
  const policy = resolveModelPolicy({
    agent: leaderAgent,
    taskType: "planning",
    riskLevel: "medium",
    preferredPolicy: leaderAgent.preferredModelPolicy
  });

  const llmResult = await runLLM({
    provider: policy.primaryProvider,
    model: policy.primaryModel,
    temperature: policy.temperature,
    maxTokens: policy.maxTokens,
    responseFormat: "json_object",
    messages: [
      {
        role: "system",
        content: [
          "你是一人公司的执行经理 Agent，负责把老板目标拆解成可执行任务。",
          "只能使用 approved memories 作为正式上下文；不要把 pending_review 或 draft 记忆写进任务判断。",
          "高风险任务包括报价、合同、付款、客户正式承诺、法律风险，必须标记 riskLevel=high 或 critical。",
          "请只返回 JSON，格式：",
          '{"summary":"...","tasks":[{"title":"...","description":"...","taskType":"content|social|data|table|simple|code|automation|general","agentRole":"leader|worker|reviewer","priority":"low|medium|high|urgent","riskLevel":"low|medium|high|critical","dueAt":null}],"longTermMemories":[{"title":"...","content":"...","summary":"...","type":"company|client|project|agent|sop|review","scope":"global|client|project|agent","tags":["..."],"reason":"...","riskLevel":"low|medium|high|critical"}]}',
          "",
          "Approved memories:",
          formatMemoriesForPrompt(memories)
        ].join("\n")
      },
      { role: "user", content: body.goal }
    ],
    metadata: {
      route: "command_center",
      ownerId,
      projectId,
      memoryIds: memories.map((memory) => memory.id),
      policy: policy.name
    }
  });

  const plan = llmResult.status === "succeeded" ? parsePlan(llmResult.content) : fallbackPlan(body.goal);
  const tasks = normalizePlanTasks(plan.tasks.length ? plan.tasks : fallbackPlan(body.goal).tasks);

  if (!supabase || !ownerId) {
    return ok(
      {
        goal: body.goal,
        summary: plan.summary ?? "本地规则已完成任务拆解。",
        tasks,
        memoriesUsed: memories,
        modelRun: llmResult,
        persisted: false,
        warning: llmResult.status === "failed" ? llmResult.error : undefined
      },
      { status: 201 }
    );
  }

  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const { data: agentRun, error: agentRunError } = await supabase
    .from("agent_runs")
    .insert({
      owner_id: ownerId,
      task_id: null,
      agent_id: isUuid(leaderAgent.id) ? leaderAgent.id : null,
      status: llmResult.status === "succeeded" ? "succeeded" : "failed",
      model: llmResult.model,
      input: { goal: body.goal, memory_ids: memories.map((memory) => memory.id), policy: policy.name },
      output: { plan, raw: llmResult.content },
      prompt_tokens: llmResult.inputTokens,
      completion_tokens: llmResult.outputTokens,
      cost: llmResult.estimatedCost,
      error: llmResult.error ?? null,
      started_at: startedAt,
      finished_at: finishedAt
    })
    .select("*")
    .single();

  if (agentRunError) return fail(agentRunError.message, 500);

  const { data: modelRun, error: modelRunError } = await supabase
    .from("model_runs")
    .insert({
      owner_id: ownerId,
      agent_run_id: agentRun.id,
      provider: llmResult.provider,
      model: llmResult.model,
      input_tokens: llmResult.inputTokens,
      output_tokens: llmResult.outputTokens,
      estimated_cost: llmResult.estimatedCost,
      latency_ms: llmResult.latencyMs,
      status: llmResult.status,
      error: llmResult.error ?? null
    })
    .select("*")
    .single();

  if (modelRunError) return fail(modelRunError.message, 500);

  const agents = await loadAssignableAgents(ownerId);
  const taskRows = tasks.map((task, index) => {
    const assignedAgentId = resolveAssignedAgentId(task, agents);
    const needsApproval = task.riskLevel === "high" || task.riskLevel === "critical";
    return {
      owner_id: ownerId,
      project_id: projectId,
      assigned_agent_id: assignedAgentId,
      title: task.title,
      description: task.description,
      task_type: task.taskType ?? "general",
      priority: task.priority ?? "medium",
      risk_level: task.riskLevel ?? "low",
      approval_status: needsApproval ? "pending" : ("not_required" satisfies ApprovalStatus),
      status: "todo",
      board_status: "todo",
      review_status: "not_required",
      sort_order: index,
      due_at: task.dueAt ?? null,
      created_by: "executive_agent"
    };
  });

  const { data: insertedTasks, error: tasksError } = await supabase.from("tasks").insert(taskRows).select("*");
  if (tasksError) return fail(tasksError.message, 500);

  const approvalRows = (insertedTasks ?? [])
    .filter((task) => task.approval_status === "pending")
    .map((task) => ({
      owner_id: ownerId,
      task_id: task.id,
      requested_by_agent_id: task.assigned_agent_id,
      status: "pending",
      reason: "High-risk task generated by Command Center requires owner approval."
    }));

  if (approvalRows.length > 0) {
    const { error: approvalError } = await supabase.from("approvals").insert(approvalRows);
    if (approvalError) return fail(approvalError.message, 500);
  }

  if (insertedTasks?.length) {
    const logRows = insertedTasks.map((task) => ({
      owner_id: ownerId,
      task_id: task.id,
      agent_id: task.assigned_agent_id,
      run_id: agentRun.id,
      type: "action",
      content: `执行经理已根据老板目标拆解任务：${task.title}`,
      metadata: {
        source: "command_center",
        goal: body.goal,
        memory_ids: memories.map((memory) => memory.id),
        model_run_id: modelRun.id,
        model: llmResult.model,
        provider: llmResult.provider,
        estimated_cost: llmResult.estimatedCost,
        latency_ms: llmResult.latencyMs
      }
    }));
    await supabase.from("task_logs").insert(logRows);
  }

  await Promise.all(
    (plan.longTermMemories ?? []).slice(0, 5).map((memory) =>
      proposeMemoryFromAgentRun({
        ownerId,
        title: memory.title,
        content: memory.content,
        summary: memory.summary,
        type: memory.type ?? "review",
        scope: memory.scope ?? "global",
        projectId,
        tags: memory.tags ?? ["command_center"],
        importance: memory.riskLevel === "high" || memory.riskLevel === "critical" ? 4 : 3,
        confidence: 0.7,
        sourceId: agentRun.id,
        createdBy: "executive_agent",
        proposedByAgentId: isUuid(leaderAgent.id) ? leaderAgent.id : null,
        reason: memory.reason ?? "Command Center generated a possible long-term memory.",
        riskLevel: memory.riskLevel ?? "medium"
      })
    )
  );

  return ok(
    {
      goal: body.goal,
      summary: plan.summary,
      tasks: insertedTasks,
      memoriesUsed: memories,
      agentRun,
      modelRun,
      persisted: true,
      warning: llmResult.status === "failed" ? llmResult.error : undefined
    },
    { status: 201 }
  );
}

async function loadLeaderAgent(ownerId?: string | null): Promise<Partial<Agent>> {
  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) {
    return fallbackAgents.find((agent) => agent.agentRole === "leader") ?? fallbackAgents[0];
  }

  const { data } = await supabase
    .from("agents")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("agent_role", "leader")
    .limit(1)
    .maybeSingle();

  return data
    ? {
        id: data.id,
        name: data.name,
        title: data.title,
        agentRole: data.agent_role,
        model: data.model,
        prompt: data.prompt,
        preferredModelPolicy: data.preferred_model_policy,
        fallbackModel: data.fallback_model
      }
    : fallbackAgents.find((agent) => agent.agentRole === "leader") ?? fallbackAgents[0];
}

async function loadAssignableAgents(ownerId: string) {
  const supabase = createSupabaseServerClient();
  if (!supabase) return fallbackAgents;
  const { data } = await supabase.from("agents").select("*").eq("owner_id", ownerId);
  return (data ?? []).map((agent) => ({
    id: agent.id,
    name: agent.name,
    title: agent.title,
    department: agent.department,
    agentRole: agent.agent_role,
    skills: agent.skills ?? []
  }));
}

function resolveAssignedAgentId(task: CommandPlanTask, agents: Array<Partial<Agent>>) {
  if (task.assignedAgentId && agents.some((agent) => agent.id === task.assignedAgentId)) return task.assignedAgentId;
  const taskType = (task.taskType ?? "").toLowerCase();
  const role = task.agentRole ?? "worker";
  const byRole = agents.find((agent) => agent.agentRole === role);
  const bySkill = agents.find((agent) => agent.skills?.some((skill) => taskType && skill.toLowerCase().includes(taskType)));
  const byDepartment = agents.find((agent) => {
    const department = String(agent.department ?? "").toLowerCase();
    return (
      (["content", "social"].includes(taskType) && department.includes("marketing")) ||
      (["automation", "code"].includes(taskType) && department.includes("operations")) ||
      (["finance", "legal"].includes(taskType) && (department.includes("finance") || department.includes("legal")))
    );
  });
  return bySkill?.id ?? byDepartment?.id ?? byRole?.id ?? agents[0]?.id ?? null;
}

function parsePlan(content: string): CommandPlan {
  try {
    const parsed = JSON.parse(content) as CommandPlan;
    return {
      summary: parsed.summary,
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      longTermMemories: Array.isArray(parsed.longTermMemories) ? parsed.longTermMemories : []
    };
  } catch {
    return fallbackPlan(content);
  }
}

function normalizePlanTasks(tasks: CommandPlanTask[]) {
  return tasks.slice(0, 12).map((task) => ({
    title: String(task.title || "未命名任务").slice(0, 120),
    description: String(task.description || "请补充任务说明。"),
    taskType: task.taskType ?? "general",
    assignedAgentId: task.assignedAgentId ?? null,
    agentRole: task.agentRole ?? "worker",
    priority: task.priority ?? "medium",
    riskLevel: task.riskLevel ?? "low",
    dueAt: task.dueAt ?? null
  }));
}

function fallbackPlan(goal: string): CommandPlan {
  return {
    summary: "已用本地规则完成基础拆解。",
    tasks: [
      {
        title: "明确目标和验收标准",
        description: `围绕「${goal}」整理成功标准、限制条件和需要老板确认的问题。`,
        taskType: "simple",
        agentRole: "leader",
        priority: "high",
        riskLevel: "low"
      },
      {
        title: "拆解执行路径",
        description: "把目标拆成里程碑、依赖关系和负责人，形成可跟踪任务清单。",
        taskType: "general",
        agentRole: "worker",
        priority: "medium",
        riskLevel: "medium"
      },
      {
        title: "风险和审批检查",
        description: "检查是否涉及报价、合同、付款、客户正式承诺或外部发布，必要时进入老板审批。",
        taskType: "review",
        agentRole: "reviewer",
        priority: "medium",
        riskLevel: "high"
      }
    ],
    longTermMemories: []
  };
}

function isUuid(value?: string | null) {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));
}
