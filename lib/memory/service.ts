import { memories as fallbackMemories } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { Agent, Memory, MemoryAccessType, MemorySourceType, MemoryStatus, RiskLevel, Task } from "@/lib/types";

type MemoryRow = Record<string, any>;

export type MemorySearchInput = {
  ownerId?: string | null;
  query?: string;
  projectId?: string | null;
  clientName?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  taskType?: string | null;
  categoryId?: string | null;
  includeStatuses?: MemoryStatus[];
  limit?: number;
};

export type CreateMemoryDraftInput = {
  ownerId?: string | null;
  type: Memory["type"];
  scope?: Memory["scope"];
  categoryId?: string | null;
  clientName?: string | null;
  projectId?: string | null;
  agentId?: string | null;
  title: string;
  content: string;
  summary?: string | null;
  tags?: string[];
  importance?: number;
  confidence?: number;
  visibility?: string;
  sourceType?: MemorySourceType;
  sourceId?: string | null;
  sourceUrl?: string | null;
  createdBy?: string | null;
  proposedByAgentId?: string | null;
  reason?: string;
  riskLevel?: RiskLevel;
};

export async function retrieveMemoryForTask(task: Partial<Task>, agent?: Partial<Agent> | null, ownerId?: string | null) {
  return searchMemories({
    ownerId,
    projectId: task.projectId,
    clientName: task.clientName,
    agentId: agent?.id ?? task.assignedAgentId,
    taskId: task.id,
    taskType: task.taskType,
    query: [task.title, task.description, task.taskType].filter(Boolean).join(" "),
    includeStatuses: ["approved"],
    limit: 8
  });
}

export async function retrieveMemoryForCommand(userInput: string, projectId?: string | null, ownerId?: string | null) {
  return searchMemories({
    ownerId,
    projectId,
    query: userInput,
    includeStatuses: ["approved"],
    limit: 8
  });
}

export async function searchMemories(input: MemorySearchInput): Promise<Memory[]> {
  const supabase = createSupabaseServerClient();
  const statuses = input.includeStatuses ?? ["approved"];
  const limit = input.limit ?? 20;

  if (!supabase || !input.ownerId) {
    return fallbackMemories
      .filter((memory) => statuses.includes(memory.status ?? "approved"))
      .filter((memory) => matchesMemory(memory, input))
      .sort((a, b) => scoreMemory(b, input.query ?? "", input) - scoreMemory(a, input.query ?? "", input))
      .slice(0, limit);
  }

  let query = supabase
    .from("memories")
    .select("*")
    .eq("owner_id", input.ownerId)
    .in("status", statuses)
    .order("importance", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (input.categoryId) query = query.eq("category_id", input.categoryId);
  if (input.projectId) query = query.or(`project_id.eq.${input.projectId},scope.eq.global`);
  if (input.agentId) query = query.or(`agent_id.eq.${input.agentId},scope.eq.global`);
  if (input.clientName) query = query.or(`client_name.ilike.%${input.clientName}%,scope.eq.global`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const rows = (data ?? []).map(normalizeMemoryRow);
  await Promise.all(
    rows.map((memory) =>
      logMemoryAccess({
        ownerId: input.ownerId,
        memoryId: memory.id,
        agentId: input.agentId,
        taskId: input.taskId,
        accessType: "retrieve"
      })
    )
  );
  return rankMemories(rows, input).slice(0, limit);
}

export async function createMemoryDraft(input: CreateMemoryDraftInput): Promise<Memory | null> {
  const supabase = createSupabaseServerClient();
  const highRisk = isHighRiskMemory(input.content) || input.riskLevel === "high" || input.riskLevel === "critical";
  const status: MemoryStatus = highRisk ? "pending_review" : "draft";

  if (!supabase || !input.ownerId) {
    return {
      id: crypto.randomUUID(),
      title: input.title,
      type: input.type,
      scope: input.scope ?? "global",
      categoryId: input.categoryId ?? null,
      content: input.content,
      summary: input.summary ?? null,
      tags: input.tags ?? [],
      clientName: input.clientName ?? null,
      projectId: input.projectId ?? null,
      agentId: input.agentId ?? null,
      importance: input.importance ?? 3,
      confidence: input.confidence ?? 0.7,
      status,
      visibility: input.visibility ?? "owner",
      sourceType: input.sourceType ?? "manual",
      sourceId: input.sourceId ?? null,
      sourceUrl: input.sourceUrl ?? null,
      createdBy: input.createdBy ?? null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from("memories")
    .insert({
      owner_id: input.ownerId,
      type: input.type,
      scope: input.scope ?? "global",
      category_id: input.categoryId,
      client_name: input.clientName,
      project_id: input.projectId,
      agent_id: input.agentId,
      title: input.title,
      content: input.content,
      summary: input.summary,
      tags: input.tags ?? [],
      importance: input.importance ?? 3,
      confidence: input.confidence ?? 0.7,
      status,
      visibility: input.visibility ?? "owner",
      source_type: input.sourceType ?? "manual",
      source_id: input.sourceId,
      source_url: input.sourceUrl,
      created_by: input.createdBy
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  const memory = normalizeMemoryRow(data);
  await logMemoryAccess({ ownerId: input.ownerId, memoryId: memory.id, agentId: input.agentId, accessType: "create" });

  if (status === "pending_review") {
    await supabase.from("memory_review_queue").insert({
      owner_id: input.ownerId,
      memory_id: memory.id,
      proposed_by_agent_id: input.proposedByAgentId ?? input.agentId,
      reason: input.reason ?? "Potentially high-risk long-term memory requires owner review.",
      risk_level: input.riskLevel === "critical" ? "high" : input.riskLevel ?? "high",
      review_status: "pending"
    });
  }

  return memory;
}

export async function proposeMemoryFromAgentRun(input: CreateMemoryDraftInput) {
  return createMemoryDraft({
    ...input,
    sourceType: input.sourceType ?? "agent_run",
    reason: input.reason ?? "Agent run produced possible long-term company memory."
  });
}

export async function approveMemory(memoryId: string, ownerId?: string | null, approvedBy = "owner") {
  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) return null;

  const { data, error } = await supabase
    .from("memories")
    .update({ status: "approved", approved_by: approvedBy, updated_at: new Date().toISOString() })
    .eq("id", memoryId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("memory_review_queue")
    .update({ review_status: "approved", reviewed_by: approvedBy, reviewed_at: new Date().toISOString() })
    .eq("memory_id", memoryId)
    .eq("owner_id", ownerId);
  await logMemoryAccess({ ownerId, memoryId, accessType: "approve" });
  return normalizeMemoryRow(data);
}

export async function rejectMemory(memoryId: string, ownerId?: string | null, reviewedBy = "owner") {
  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) return null;

  const { data, error } = await supabase
    .from("memories")
    .update({ status: "rejected", updated_at: new Date().toISOString() })
    .eq("id", memoryId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await supabase
    .from("memory_review_queue")
    .update({ review_status: "rejected", reviewed_by: reviewedBy, reviewed_at: new Date().toISOString() })
    .eq("memory_id", memoryId)
    .eq("owner_id", ownerId);
  await logMemoryAccess({ ownerId, memoryId, accessType: "reject" });
  return normalizeMemoryRow(data);
}

export async function archiveMemory(memoryId: string, ownerId?: string | null) {
  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) return null;
  const { data, error } = await supabase
    .from("memories")
    .update({ status: "archived", updated_at: new Date().toISOString() })
    .eq("id", memoryId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await logMemoryAccess({ ownerId, memoryId, accessType: "archive" });
  return normalizeMemoryRow(data);
}

export async function logMemoryAccess(input: {
  ownerId?: string | null;
  memoryId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  accessType: MemoryAccessType;
}) {
  const supabase = createSupabaseServerClient();
  if (!supabase || !input.ownerId || !input.memoryId) return;
  await supabase.from("memory_access_logs").insert({
    owner_id: input.ownerId,
    memory_id: input.memoryId,
    agent_id: input.agentId,
    task_id: input.taskId,
    access_type: input.accessType
  });
  await supabase.from("memories").update({ last_accessed_at: new Date().toISOString() }).eq("id", input.memoryId);
}

export function formatMemoriesForPrompt(memories: Memory[]) {
  if (!memories.length) return "No approved memory was retrieved.";
  return memories
    .map((memory, index) => {
      const summary = memory.summary || memory.content;
      return `${index + 1}. [${memory.type}/${memory.scope ?? "global"}/importance:${memory.importance ?? 3}] ${memory.title}: ${summary}`;
    })
    .join("\n");
}

export function isHighRiskMemory(content: string) {
  return /(报价|合同|付款|发票|退款|正式承诺|客户承诺|法律|违约|价格|收款|银行|bank|contract|payment|invoice|quote)/i.test(content);
}

function matchesMemory(memory: Memory, input: MemorySearchInput) {
  if (input.categoryId && memory.categoryId !== input.categoryId) return false;
  if (input.projectId && memory.projectId && memory.projectId !== input.projectId) return false;
  if (input.agentId && memory.agentId && memory.agentId !== input.agentId) return false;
  if (input.clientName && memory.clientName && !memory.clientName.includes(input.clientName)) return false;
  return true;
}

function rankMemories(memories: Memory[], input: MemorySearchInput) {
  const query = (input.query ?? "").toLowerCase();
  return [...memories].sort((a, b) => scoreMemory(b, query, input) - scoreMemory(a, query, input));
}

function scoreMemory(memory: Memory, query: string, input: MemorySearchInput) {
  let score = memory.importance ?? 3;
  if (memory.scope === "global") score += 0.5;
  if (input.categoryId && memory.categoryId === input.categoryId) score += 2;
  if (input.projectId && memory.projectId === input.projectId) score += 3;
  if (input.agentId && memory.agentId === input.agentId) score += 2;
  if (input.clientName && memory.clientName?.includes(input.clientName)) score += 2;
  if (query && `${memory.title} ${memory.summary ?? ""} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(query.slice(0, 24))) score += 1;
  return score;
}

function normalizeMemoryRow(row: MemoryRow): Memory {
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    scope: row.scope ?? "global",
    categoryId: row.category_id ?? null,
    content: row.content,
    summary: row.summary ?? null,
    tags: row.tags ?? [],
    relatedClient: row.related_client ?? row.client_name ?? null,
    clientName: row.client_name ?? row.related_client ?? null,
    projectId: row.project_id ?? null,
    agentId: row.agent_id ?? null,
    importance: Number(row.importance ?? 3),
    confidence: Number(row.confidence ?? 0.8),
    status: row.status ?? "approved",
    visibility: row.visibility ?? "owner",
    sourceType: row.source_type ?? "manual",
    sourceId: row.source_id ?? null,
    sourceUrl: row.source_url ?? null,
    createdBy: row.created_by ?? null,
    approvedBy: row.approved_by ?? null,
    lastAccessedAt: row.last_accessed_at ?? null,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? new Date().toISOString()
  };
}
