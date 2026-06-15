import type { Agent, AgentSkill, KnowledgeSource, Memory, MemoryAccessLog, MemoryCategory, MemoryRelation, ModelCatalogItem, ModelPolicy, ModelProvider, ModelRunSummary, Project, Skill, SkillReview, SkillRun, Task } from "@/lib/types";

type AnyRow = Record<string, any>;

export function normalizeAgent(row: AnyRow): Agent {
  return {
    id: row.id,
    name: row.name,
    department: row.department,
    title: row.title,
    managerId: row.managerId ?? row.manager_id ?? null,
    model: row.model,
    prompt: row.prompt,
    toolPermissions: row.toolPermissions ?? row.tool_permissions ?? [],
    status: row.status ?? "idle",
    agentRole: row.agentRole ?? row.agent_role ?? "worker",
    skills: row.skills ?? [],
    workload: Number(row.workload ?? 0),
    modelPolicyId: row.modelPolicyId ?? row.model_policy_id ?? null,
    preferredModelPolicy: row.preferredModelPolicy ?? row.preferred_model_policy ?? null,
    preferredProvider: row.preferredProvider ?? row.preferred_provider ?? null,
    preferredModel: row.preferredModel ?? row.preferred_model ?? null,
    fallbackProvider: row.fallbackProvider ?? row.fallback_provider ?? null,
    fallbackModel: row.fallbackModel ?? row.fallback_model ?? null,
    maxCostPerRun: row.maxCostPerRun ?? row.max_cost_per_run ?? null,
    temperature: row.temperature ?? null,
    maxTokens: row.maxTokens ?? row.max_tokens ?? null,
    currentFocus: row.currentFocus ?? row.current_focus ?? "",
    successRate: Number(row.successRate ?? row.success_rate ?? 0)
  };
}

export function normalizeProject(row: AnyRow): Project {
  const relationAgents = Array.isArray(row.project_agents)
    ? row.project_agents.map((item: AnyRow) => item.agent_id).filter(Boolean)
    : [];

  return {
    id: row.id,
    name: row.name,
    clientName: row.clientName ?? row.client_name,
    objective: row.objective,
    clientProfile: row.clientProfile ?? row.client_profile ?? "",
    brief: row.brief ?? null,
    progress: Number(row.progress ?? 0),
    stage: row.stage ?? "planning",
    riskLevel: row.riskLevel ?? row.risk_level ?? "low",
    agentIds: row.agentIds ?? row.agent_ids ?? relationAgents,
    dueDate: row.dueDate ?? row.due_date
  };
}

export function normalizeTask(row: AnyRow): Task {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    taskType: row.taskType ?? row.task_type ?? "general",
    suggestedSkills: row.suggestedSkills ?? row.suggested_skills ?? [],
    clientName: row.clientName ?? row.client_name ?? null,
    projectId: row.projectId ?? row.project_id ?? null,
    assignedAgentId: row.assignedAgentId ?? row.assigned_agent_id ?? null,
    assignedAgentRole: row.assignedAgentRole ?? row.assigned_agent_role ?? null,
    priority: row.priority ?? "medium",
    riskLevel: row.riskLevel ?? row.risk_level ?? "low",
    dueAt: row.dueAt ?? row.due_at ?? null,
    status: row.status ?? "todo",
    boardStatus: row.boardStatus ?? row.board_status ?? row.status ?? "todo",
    approvalStatus: row.approvalStatus ?? row.approval_status ?? "not_required",
    approvalRequired: Boolean(row.approvalRequired ?? row.approval_required ?? false),
    reviewStatus: row.reviewStatus ?? row.review_status ?? "not_required",
    modelPolicy: row.modelPolicy ?? row.model_policy ?? null,
    inputRequirements: row.inputRequirements ?? row.input_requirements ?? null,
    outputRequirements: row.outputRequirements ?? row.output_requirements ?? null,
    result: row.result ?? null,
    estimatedCost: Number(row.estimatedCost ?? row.estimated_cost ?? 0),
    actualCost: Number(row.actualCost ?? row.actual_cost ?? 0),
    parentTaskId: row.parentTaskId ?? row.parent_task_id ?? null,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    usedMemoryIds: row.usedMemoryIds ?? row.used_memory_ids ?? row.memory_ids ?? [],
    modelRun: row.modelRun ?? row.model_run ?? null,
    outputs: row.outputs ?? []
  };
}

export function normalizeMemory(row: AnyRow): Memory {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    scope: row.scope ?? "global",
    categoryId: row.categoryId ?? row.category_id ?? null,
    content: row.content,
    summary: row.summary ?? null,
    tags: row.tags ?? [],
    relatedClient: row.relatedClient ?? row.related_client ?? null,
    clientName: row.clientName ?? row.client_name ?? row.related_client ?? null,
    projectId: row.projectId ?? row.project_id ?? null,
    agentId: row.agentId ?? row.agent_id ?? null,
    importance: Number(row.importance ?? 3),
    confidence: Number(row.confidence ?? 0.8),
    status: row.status ?? "approved",
    visibility: row.visibility ?? "owner",
    sourceType: row.sourceType ?? row.source_type ?? "manual",
    sourceId: row.sourceId ?? row.source_id ?? null,
    sourceUrl: row.sourceUrl ?? row.source_url ?? null,
    createdBy: row.createdBy ?? row.created_by ?? null,
    approvedBy: row.approvedBy ?? row.approved_by ?? null,
    lastAccessedAt: row.lastAccessedAt ?? row.last_accessed_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? new Date().toISOString()
  };
}

export function normalizeMemoryCategory(row: AnyRow): MemoryCategory {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    parentId: row.parentId ?? row.parent_id ?? null,
    description: row.description ?? null,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeMemoryRelation(row: AnyRow): MemoryRelation {
  return {
    id: row.id,
    memoryId: row.memoryId ?? row.memory_id,
    relatedType: row.relatedType ?? row.related_type,
    relatedId: row.relatedId ?? row.related_id,
    relationType: row.relationType ?? row.relation_type,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString()
  };
}

export function normalizeMemoryAccessLog(row: AnyRow): MemoryAccessLog {
  return {
    id: row.id,
    memoryId: row.memoryId ?? row.memory_id ?? null,
    agentId: row.agentId ?? row.agent_id ?? null,
    taskId: row.taskId ?? row.task_id ?? null,
    accessType: row.accessType ?? row.access_type ?? "retrieve",
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString(),
    memoryTitle: row.memoryTitle ?? row.memory?.title ?? null,
    agentName: row.agentName ?? row.agent?.name ?? null,
    taskTitle: row.taskTitle ?? row.task?.title ?? null
  };
}

export function normalizeKnowledgeSource(row: AnyRow): KnowledgeSource {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    sourceUrl: row.sourceUrl ?? row.source_url ?? null,
    syncMode: row.syncMode ?? row.sync_mode ?? "manual",
    status: row.status ?? "active",
    lastSyncedAt: row.lastSyncedAt ?? row.last_synced_at ?? null,
    metadata: row.metadata ?? {},
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeModelProvider(row: AnyRow): ModelProvider {
  return {
    id: row.id,
    name: row.name ?? row.slug,
    displayName: row.displayName ?? row.display_name ?? row.name,
    baseUrl: row.baseUrl ?? row.base_url ?? null,
    apiKeyEnv: row.apiKeyEnv ?? row.api_key_env ?? "",
    enabled: Boolean(row.enabled ?? true),
    status: row.status ?? "missing_key",
    notes: row.notes ?? null,
    lastCheckedAt: row.lastCheckedAt ?? row.last_checked_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeModelCatalogItem(row: AnyRow): ModelCatalogItem {
  return {
    id: row.id,
    provider: row.provider,
    model: row.model,
    displayName: row.displayName ?? row.display_name ?? row.model,
    contextWindow: row.contextWindow ?? row.context_window ?? null,
    inputCostPer1m: row.inputCostPer1m ?? row.input_cost_per_1m ?? null,
    outputCostPer1m: row.outputCostPer1m ?? row.output_cost_per_1m ?? null,
    capabilities: row.capabilities ?? [],
    recommendedUse: row.recommendedUse ?? row.recommended_use ?? [],
    enabled: Boolean(row.enabled ?? true),
    notes: row.notes ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeModelPolicy(row: AnyRow): ModelPolicy {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    agentRole: row.agentRole ?? row.agent_role ?? null,
    taskType: row.taskType ?? row.task_type ?? null,
    riskLevel: row.riskLevel ?? row.risk_level ?? null,
    primaryProvider: row.primaryProvider ?? row.primary_provider ?? "openai",
    primaryModel: row.primaryModel ?? row.primary_model ?? "gpt-4o-mini",
    fallbackProvider: row.fallbackProvider ?? row.fallback_provider ?? "openai",
    fallbackModel: row.fallbackModel ?? row.fallback_model ?? "gpt-4o-mini",
    temperature: Number(row.temperature ?? 0.2),
    maxTokens: Number(row.maxTokens ?? row.max_tokens ?? 1600),
    costLevel: row.costLevel ?? row.cost_level ?? "low",
    enabled: Boolean(row.enabled ?? true)
  };
}

export function normalizeModelRun(row: AnyRow): ModelRunSummary {
  return {
    id: row.id,
    agentRunId: row.agentRunId ?? row.agent_run_id ?? null,
    taskId: row.taskId ?? row.task_id ?? null,
    agentId: row.agentId ?? row.agent_id ?? null,
    policyName: row.policyName ?? row.policy_name ?? null,
    provider: row.provider,
    model: row.model,
    inputTokens: Number(row.inputTokens ?? row.input_tokens ?? 0),
    outputTokens: Number(row.outputTokens ?? row.output_tokens ?? 0),
    estimatedCost: Number(row.estimatedCost ?? row.estimated_cost ?? 0),
    latencyMs: Number(row.latencyMs ?? row.latency_ms ?? 0),
    status: row.status ?? "success",
    error: row.error ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined
  };
}

export function normalizeSkill(row: AnyRow): Skill {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    category: row.category,
    description: row.description ?? "",
    instructions: row.instructions ?? "",
    inputSchema: row.inputSchema ?? row.input_schema ?? null,
    outputSchema: row.outputSchema ?? row.output_schema ?? null,
    riskLevel: row.riskLevel ?? row.risk_level ?? "low",
    skillType: row.skillType ?? row.skill_type ?? "knowledge",
    requiredTools: row.requiredTools ?? row.required_tools ?? [],
    requiredMemoryTypes: row.requiredMemoryTypes ?? row.required_memory_types ?? [],
    approvalRequired: Boolean(row.approvalRequired ?? row.approval_required ?? false),
    source: row.source ?? "custom",
    sourceUrl: row.sourceUrl ?? row.source_url ?? null,
    license: row.license ?? null,
    version: row.version ?? null,
    enabled: Boolean(row.enabled ?? true),
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeAgentSkill(row: AnyRow): AgentSkill {
  return {
    id: row.id,
    agentId: row.agentId ?? row.agent_id,
    skillId: row.skillId ?? row.skill_id,
    priority: row.priority ?? "secondary",
    enabled: Boolean(row.enabled ?? true),
    config: row.config ?? null,
    createdAt: row.createdAt ?? row.created_at ?? undefined,
    updatedAt: row.updatedAt ?? row.updated_at ?? undefined
  };
}

export function normalizeSkillRun(row: AnyRow): SkillRun {
  return {
    id: row.id,
    skillId: row.skillId ?? row.skill_id,
    agentId: row.agentId ?? row.agent_id ?? null,
    taskId: row.taskId ?? row.task_id ?? null,
    agentRunId: row.agentRunId ?? row.agent_run_id ?? null,
    modelRunId: row.modelRunId ?? row.model_run_id ?? null,
    status: row.status ?? "success",
    input: row.input ?? null,
    output: row.output ?? null,
    error: row.error ?? null,
    latencyMs: row.latencyMs ?? row.latency_ms ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString()
  };
}

export function normalizeSkillReview(row: AnyRow): SkillReview {
  return {
    id: row.id,
    skillId: row.skillId ?? row.skill_id,
    reviewStatus: row.reviewStatus ?? row.review_status ?? "pending",
    riskNotes: row.riskNotes ?? row.risk_notes ?? null,
    reviewedBy: row.reviewedBy ?? row.reviewed_by ?? null,
    reviewedAt: row.reviewedAt ?? row.reviewed_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? new Date().toISOString()
  };
}

export async function readApiData<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body.data as T;
}
