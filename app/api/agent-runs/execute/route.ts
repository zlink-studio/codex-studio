import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { resolveModelPolicy, runLLM } from "@/lib/llm/router";
import { formatMemoriesForPrompt, retrieveMemoryForTask } from "@/lib/memory/service";
import { agents as fallbackAgents, tasks as fallbackTasks } from "@/lib/mock-data";
import { isDemoDataEnabled, setupRequiredPayload } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Agent, Task } from "@/lib/types";

type ExecuteBody = {
  task_id?: string;
  taskId?: string;
  agent_id?: string;
  agentId?: string;
  owner_id?: string;
  ownerId?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<ExecuteBody>(request);
  const taskId = body?.task_id ?? body?.taskId;
  if (!taskId) return fail("task_id is required");

  const supabase = createSupabaseServerClient();
  const ownerId = resolveOwnerId(body);

  if (!supabase || !ownerId) {
    if (!isDemoDataEnabled()) return fail(setupRequiredPayload("agent_runs").message, 503);
    return executeDemoTask(taskId, body);
  }

  const { data: taskRow, error: taskError } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", taskId)
    .eq("owner_id", ownerId)
    .single();
  if (taskError) return fail(taskError.message, 404);

  if (taskRow.approval_status === "pending") {
    return fail("This task is waiting for owner approval and cannot be executed yet.", 409);
  }
  if (taskRow.approval_status === "rejected") {
    return fail("This task was rejected by owner approval and cannot be executed.", 409);
  }
  if (taskRow.board_status === "done" || taskRow.status === "done") {
    return fail("This task is already done.", 409);
  }

  const agentId = body?.agent_id ?? body?.agentId ?? taskRow.assigned_agent_id;
  if (!agentId) return fail("agent_id is required because the task has no assigned agent");

  const { data: agentRow, error: agentError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", agentId)
    .eq("owner_id", ownerId)
    .single();
  if (agentError) return fail(agentError.message, 404);

  const task = normalizeTaskForExecution(taskRow);
  const agent = normalizeAgentForRouting(agentRow);
  const memories = await retrieveMemoryForTask(task, agent, ownerId);
  const policy = resolveModelPolicy({
    agent,
    taskType: task.taskType,
    riskLevel: task.riskLevel,
    preferredPolicy: agent.preferredModelPolicy
  });

  const startedAt = new Date().toISOString();
  await supabase
    .from("tasks")
    .update({
      status: "in_progress",
      board_status: "in_progress",
      review_status: "not_required",
      updated_at: startedAt
    })
    .eq("id", task.id);

  const { data: agentRun, error: runError } = await supabase
    .from("agent_runs")
    .insert({
      owner_id: ownerId,
      task_id: task.id,
      agent_id: agent.id,
      status: "running",
      model: policy.primaryModel,
      input: {
        task_id: task.id,
        task_title: task.title,
        task_type: task.taskType,
        risk_level: task.riskLevel,
        memory_ids: memories.map((memory) => memory.id),
        policy: policy.name
      },
      started_at: startedAt
    })
    .select("*")
    .single();
  if (runError) return fail(runError.message, 500);

  await supabase.from("task_logs").insert({
    owner_id: ownerId,
    task_id: task.id,
    agent_id: agent.id,
    run_id: agentRun.id,
    type: "thinking",
    content: `${agent.name} started executing the task with model policy ${policy.name}.`,
    metadata: {
      stage: "started",
      model_policy: policy.name,
      memory_ids: memories.map((memory) => memory.id)
    }
  });

  const llmResult = await runLLM({
    provider: policy.primaryProvider,
    model: policy.primaryModel,
    temperature: agent.temperature ?? policy.temperature,
    maxTokens: agent.maxTokens ?? policy.maxTokens,
    messages: [
      {
        role: "system",
        content: [
          agent.prompt || `你是 ${agent.title}。`,
          "你正在一人公司 AI 数字员工工作台中执行任务。",
          "只能使用 approved memories 作为正式依据。",
          "输出必须包含：完成内容、关键判断、风险、建议下一步。",
          "输出要清晰、可交付，避免空泛表述。",
          "",
          "Approved memories:",
          formatMemoriesForPrompt(memories)
        ].join("\n")
      },
      {
        role: "user",
        content: [
          `任务标题：${task.title}`,
          `任务类型：${task.taskType ?? "general"}`,
          `风险等级：${task.riskLevel}`,
          `任务说明：${task.description}`
        ].join("\n")
      }
    ],
    metadata: {
      route: "agent_run_execute",
      taskId: task.id,
      agentId: agent.id,
      policy: policy.name,
      memoryIds: memories.map((memory) => memory.id)
    }
  });

  const output = llmResult.status === "succeeded" ? llmResult.content : fallbackExecutionOutput(task, agent, memories.length);
  const finishedAt = new Date().toISOString();
  const taskSucceeded = llmResult.status === "succeeded";

  const { data: updatedRun, error: updateRunError } = await supabase
    .from("agent_runs")
    .update({
      status: taskSucceeded ? "succeeded" : "failed",
      model: llmResult.model,
      output: { content: output, raw: llmResult.content },
      prompt_tokens: llmResult.inputTokens,
      completion_tokens: llmResult.outputTokens,
      cost: llmResult.estimatedCost,
      error: llmResult.error ?? null,
      finished_at: finishedAt
    })
    .eq("id", agentRun.id)
    .select("*")
    .single();
  if (updateRunError) return fail(updateRunError.message, 500);

  const { data: modelRun, error: modelRunError } = await supabase
    .from("model_runs")
    .insert({
      owner_id: ownerId,
      agent_run_id: agentRun.id,
      task_id: task.id,
      agent_id: agent.id,
      policy_name: policy.name,
      provider: llmResult.provider,
      model: llmResult.model,
      input_tokens: llmResult.inputTokens,
      output_tokens: llmResult.outputTokens,
      estimated_cost: llmResult.estimatedCost,
      latency_ms: llmResult.latencyMs,
      status: taskSucceeded ? "success" : "error",
      error: llmResult.error ?? null
    })
    .select("*")
    .single();
  if (modelRunError) return fail(modelRunError.message, 500);

  const outputs = Array.isArray(taskRow.outputs) ? taskRow.outputs : [];
  const nextOutput = { agentId: agent.id, content: output, createdAt: finishedAt };
  const { data: updatedTask, error: taskUpdateError } = await supabase
    .from("tasks")
    .update({
      outputs: [...outputs, nextOutput],
      status: taskSucceeded ? "review" : "blocked",
      board_status: taskSucceeded ? "review" : "blocked",
      review_status: taskSucceeded ? "pending" : "rejected",
      updated_at: finishedAt
    })
    .eq("id", task.id)
    .select("*")
    .single();
  if (taskUpdateError) return fail(taskUpdateError.message, 500);

  const { data: resultLog } = await supabase
    .from("task_logs")
    .insert({
      owner_id: ownerId,
      task_id: task.id,
      agent_id: agent.id,
      run_id: agentRun.id,
      type: taskSucceeded ? "result" : "error",
      content: output,
      metadata: {
        stage: taskSucceeded ? "completed" : "failed",
        source: "agent_run_execute",
        memory_ids: memories.map((memory) => memory.id),
        model_run_id: modelRun.id,
        model_policy: policy.name,
        provider: llmResult.provider,
        model: llmResult.model,
        estimated_cost: llmResult.estimatedCost,
        latency_ms: llmResult.latencyMs
      }
    })
    .select("*")
    .single();

  await supabase.from("quality_reviews").insert({
    owner_id: ownerId,
    task_id: task.id,
    reviewer_agent_id: agent.id,
    status: taskSucceeded ? "pending" : "rejected",
    checklist: [
      { label: "输出符合任务目标", passed: taskSucceeded },
      { label: "风险和审批状态已处理", passed: taskSucceeded },
      { label: "可交付给老板或客户", passed: taskSucceeded }
    ],
    notes: taskSucceeded ? "Agent 执行完成，等待 Review Gate。" : llmResult.error ?? "Agent 执行失败，任务已阻塞。",
    decided_at: taskSucceeded ? null : finishedAt
  });

  return ok(
    {
      persisted: true,
      task: updatedTask,
      agentRun: updatedRun,
      modelRun,
      log: resultLog,
      memoriesUsed: memories,
      warning: taskSucceeded ? undefined : llmResult.error
    },
    { status: 201 }
  );
}

async function executeDemoTask(taskId: string, body: ExecuteBody | null) {
  const task = fallbackTasks.find((item) => item.id === taskId);
  if (!task) return fail("Task not found", 404);
  if (task.approvalStatus === "pending") return fail("This task is waiting for owner approval and cannot be executed yet.", 409);

  const agent = fallbackAgents.find((item) => item.id === (body?.agent_id ?? body?.agentId ?? task.assignedAgentId)) ?? fallbackAgents[0];
  const memories = await retrieveMemoryForTask(task, agent, null);
  const policy = resolveModelPolicy({ agent, taskType: task.taskType, riskLevel: task.riskLevel });
  const output = fallbackExecutionOutput(task, agent, memories.length);
  const createdAt = new Date().toISOString();

  return ok(
    {
      persisted: false,
      task: {
        ...task,
        status: "review",
        boardStatus: "review",
        reviewStatus: "pending",
        outputs: [...task.outputs, { agentId: agent.id, content: output, createdAt }]
      },
      agentRun: {
        id: crypto.randomUUID(),
        task_id: task.id,
        agent_id: agent.id,
        status: "succeeded",
        model: policy.primaryModel,
        output: { content: output },
        started_at: createdAt,
        finished_at: createdAt
      },
      modelRun: {
        id: crypto.randomUUID(),
        provider: policy.primaryProvider,
        model: policy.primaryModel,
        status: "success",
        policy_name: policy.name,
        input_tokens: 0,
        output_tokens: 0,
        estimated_cost: 0,
        latency_ms: 0
      },
      log: {
        id: crypto.randomUUID(),
        task_id: task.id,
        agent_id: agent.id,
        type: "result",
        content: output,
        metadata: { memory_ids: memories.map((memory) => memory.id), stage: "completed" },
        created_at: createdAt
      },
      memoriesUsed: memories
    },
    { status: 201 }
  );
}

function normalizeTaskForExecution(row: Record<string, any>): Partial<Task> {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    taskType: row.task_type,
    clientName: row.client_name,
    projectId: row.project_id,
    assignedAgentId: row.assigned_agent_id,
    riskLevel: row.risk_level
  };
}

function normalizeAgentForRouting(row: Record<string, any>): Partial<Agent> {
  return {
    id: row.id,
    name: row.name,
    title: row.title,
    department: row.department,
    prompt: row.prompt,
    model: row.model,
    agentRole: row.agent_role,
    skills: row.skills ?? [],
    preferredModelPolicy: row.preferred_model_policy,
    preferredProvider: row.preferred_provider,
    preferredModel: row.preferred_model,
    fallbackProvider: row.fallback_provider,
    fallbackModel: row.fallback_model,
    temperature: row.temperature,
    maxTokens: row.max_tokens
  };
}

function fallbackExecutionOutput(task: Partial<Task>, agent: Partial<Agent>, memoryCount: number) {
  return [
    `执行 Agent：${agent.name ?? "数字员工"}`,
    `任务：${task.title}`,
    `已读取 approved memory：${memoryCount} 条`,
    "",
    "本轮执行结果：",
    "- 已根据任务目标完成初步分析与交付草稿。",
    `- 风险等级为 ${task.riskLevel ?? "low"}，请在 Review Gate 中复核。`,
    "- 下一步建议：老板或 Reviewer 确认输出质量后，再进入 Done。"
  ].join("\n");
}
