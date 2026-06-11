import type { Agent, KnowledgeSource, Memory, MemoryAccessLog, MemoryCategory, MemoryRelation, Project, Task } from "@/lib/types";

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
    preferredModelPolicy: row.preferredModelPolicy ?? row.preferred_model_policy ?? null,
    fallbackModel: row.fallbackModel ?? row.fallback_model ?? null,
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
    progress: Number(row.progress ?? 0),
    stage: row.stage ?? "planning",
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
    clientName: row.clientName ?? row.client_name ?? null,
    projectId: row.projectId ?? row.project_id ?? null,
    assignedAgentId: row.assignedAgentId ?? row.assigned_agent_id ?? null,
    priority: row.priority ?? "medium",
    riskLevel: row.riskLevel ?? row.risk_level ?? "low",
    dueAt: row.dueAt ?? row.due_at ?? null,
    status: row.status ?? "todo",
    boardStatus: row.boardStatus ?? row.board_status ?? row.status ?? "todo",
    approvalStatus: row.approvalStatus ?? row.approval_status ?? "not_required",
    reviewStatus: row.reviewStatus ?? row.review_status ?? "not_required",
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

export async function readApiData<T>(response: Response): Promise<T> {
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error ?? "Request failed");
  }
  return body.data as T;
}
