import { promises as fs } from "fs";
import path from "path";
import {
  agentSkills as seedAgentSkills,
  agents as seedAgents,
  dailyReport as seedDailyReport,
  projects as seedProjects,
  skillReviews as seedSkillReviews,
  skillRuns as seedSkillRuns,
  skills as seedSkills,
  tasks as seedTasks
} from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

const dataDir = path.join(process.cwd(), "work", "local-data");

type CollectionName =
  | "agents"
  | "skills"
  | "agent-skills"
  | "skill-runs"
  | "skill-reviews"
  | "agent-runs"
  | "model-runs"
  | "tasks"
  | "projects"
  | "approvals"
  | "quality-reviews"
  | "task-logs"
  | "daily-reports"
  | "deliverables"
  | "project-logs";

type AnyRow = Record<string, unknown>;

const seedApprovals = seedTasks
  .filter((task) => task.approvalStatus === "pending")
  .map((task) => ({
    id: `approval-${task.id}`,
    task_id: task.id,
    status: "pending",
    reason: "Seed approval",
    decision_note: null,
    created_at: new Date().toISOString(),
    decided_at: null
  }));

const seedQualityReviews = seedTasks
  .filter((task) => task.boardStatus === "review" || task.reviewStatus === "pending")
  .map((task) => ({
    id: `review-${task.id}`,
    task_id: task.id,
    reviewer_agent_id: task.assignedAgentId ?? null,
    status: task.reviewStatus ?? "pending",
    score: null,
    checklist: [],
    notes: null,
    created_at: new Date().toISOString(),
    decided_at: null
  }));

const seedMap: Record<CollectionName, unknown[]> = {
  agents: seedAgents,
  skills: seedSkills,
  "agent-skills": seedAgentSkills,
  "skill-runs": seedSkillRuns,
  "skill-reviews": seedSkillReviews,
  "agent-runs": [],
  "model-runs": [],
  tasks: seedTasks,
  projects: seedProjects,
  approvals: seedApprovals,
  "quality-reviews": seedQualityReviews,
  "task-logs": [],
  "daily-reports": [seedDailyReport],
  deliverables: [],
  "project-logs": []
};

const cloudConfig: Partial<Record<CollectionName, { table: string; columns: string[] }>> = {
  agents: {
    table: "agents",
    columns: [
      "id",
      "owner_id",
      "name",
      "department",
      "title",
      "manager_id",
      "model",
      "prompt",
      "tool_permissions",
      "status",
      "agent_role",
      "skills",
      "workload",
      "model_policy_id",
      "preferred_model_policy",
      "preferred_provider",
      "preferred_model",
      "fallback_provider",
      "fallback_model",
      "max_cost_per_run",
      "temperature",
      "max_tokens",
      "current_focus",
      "success_rate",
      "created_at",
      "updated_at"
    ]
  },
  projects: {
    table: "projects",
    columns: [
      "id",
      "owner_id",
      "name",
      "client_name",
      "objective",
      "client_profile",
      "progress",
      "stage",
      "due_date",
      "created_at",
      "updated_at"
    ]
  },
  tasks: {
    table: "tasks",
    columns: [
      "id",
      "owner_id",
      "project_id",
      "assigned_agent_id",
      "title",
      "description",
      "task_type",
      "priority",
      "risk_level",
      "status",
      "board_status",
      "approval_status",
      "review_status",
      "estimated_cost",
      "actual_cost",
      "parent_task_id",
      "sort_order",
      "due_at",
      "outputs",
      "created_by",
      "created_at",
      "updated_at"
    ]
  },
  "agent-runs": {
    table: "agent_runs",
    columns: [
      "id",
      "owner_id",
      "task_id",
      "agent_id",
      "status",
      "model",
      "input",
      "output",
      "prompt_tokens",
      "completion_tokens",
      "cost",
      "error",
      "started_at",
      "finished_at",
      "created_at"
    ]
  },
  "model-runs": {
    table: "model_runs",
    columns: [
      "id",
      "owner_id",
      "agent_run_id",
      "task_id",
      "agent_id",
      "policy_name",
      "provider",
      "model",
      "input_tokens",
      "output_tokens",
      "estimated_cost",
      "latency_ms",
      "status",
      "error",
      "created_at"
    ]
  },
  approvals: {
    table: "approvals",
    columns: [
      "id",
      "owner_id",
      "task_id",
      "requested_by_agent_id",
      "status",
      "reason",
      "decision_note",
      "decided_at",
      "created_at"
    ]
  },
  "quality-reviews": {
    table: "quality_reviews",
    columns: [
      "id",
      "owner_id",
      "task_id",
      "reviewer_agent_id",
      "status",
      "score",
      "checklist",
      "notes",
      "created_at",
      "decided_at"
    ]
  },
  "task-logs": {
    table: "task_logs",
    columns: ["id", "owner_id", "task_id", "agent_id", "run_id", "type", "content", "metadata", "created_at"]
  }
};

const cloudSeedOrder: CollectionName[] = [
  "agents",
  "projects",
  "tasks",
  "agent-runs",
  "model-runs",
  "task-logs",
  "quality-reviews",
  "approvals"
];

let cloudSeedPromise: Promise<void> | null = null;
let cloudDisabledUntil = 0;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function filePath(name: CollectionName) {
  return path.join(dataDir, `${name}.json`);
}

function extractFirstJsonValue(raw: string) {
  const start = raw.search(/[{\[]/);
  if (start === -1) {
    return null;
  }

  const opening = raw[start];
  const closing = opening === "[" ? "]" : "}";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === opening) {
      depth += 1;
      continue;
    }

    if (char === closing) {
      depth -= 1;
      if (depth === 0) {
        return raw.slice(start, index + 1);
      }
    }
  }

  return null;
}

async function parseCollectionFile<T>(target: string, raw: string): Promise<T[]> {
  try {
    return JSON.parse(raw) as T[];
  } catch (error) {
    const recovered = extractFirstJsonValue(raw);
    if (!recovered) {
      throw error;
    }

    const parsed = JSON.parse(recovered) as T[];
    const backupPath = `${target}.corrupt-${Date.now()}.bak`;
    await fs.writeFile(backupPath, raw, "utf8");
    await fs.writeFile(target, JSON.stringify(parsed, null, 2), "utf8");
    return parsed;
  }
}

async function ensureCollection(name: CollectionName) {
  await fs.mkdir(dataDir, { recursive: true });
  const target = filePath(name);

  try {
    await fs.access(target);
  } catch {
    await fs.writeFile(target, JSON.stringify(seedMap[name], null, 2), "utf8");
  }

  return target;
}

async function readLocalCollection<T>(name: CollectionName): Promise<T[]> {
  const target = await ensureCollection(name);
  const raw = await fs.readFile(target, "utf8");
  return parseCollectionFile<T>(target, raw);
}

async function writeLocalCollection<T>(name: CollectionName, data: T[]) {
  const target = await ensureCollection(name);
  await fs.writeFile(target, JSON.stringify(data, null, 2), "utf8");
}

function getSupabase() {
  return createSupabaseServerClient();
}

function getOwnerId() {
  return process.env.DEMO_OWNER_ID ?? null;
}

function isCloudBacked(name: CollectionName): boolean {
  return Boolean(cloudConfig[name] && getSupabase() && getOwnerId() && Date.now() > cloudDisabledUntil);
}

function markCloudUnavailable() {
  cloudDisabledUntil = Date.now() + 5 * 60 * 1000;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function getRowValue(row: AnyRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined) {
      return value;
    }
  }
  return undefined;
}

function shouldSyncRow(name: CollectionName, row: AnyRow) {
  switch (name) {
    case "agents":
      return typeof row.id === "string" && row.id.length > 0;
    case "projects":
      return isUuid(row.id);
    case "tasks":
      return isUuid(row.id) && isUuid(getRowValue(row, "project_id", "projectId"));
    case "agent-runs":
      return isUuid(row.id) && isUuid(getRowValue(row, "task_id", "taskId"));
    case "model-runs":
      return (
        isUuid(row.id) &&
        isUuid(getRowValue(row, "task_id", "taskId")) &&
        isUuid(getRowValue(row, "agent_run_id", "agentRunId"))
      );
    case "task-logs":
      return isUuid(row.id) && isUuid(getRowValue(row, "task_id", "taskId"));
    case "quality-reviews":
      return isUuid(row.id) && isUuid(getRowValue(row, "task_id", "taskId"));
    case "approvals":
      return isUuid(row.id) && isUuid(getRowValue(row, "task_id", "taskId"));
    default:
      return true;
  }
}

function filterSyncableRows(name: CollectionName, rows: AnyRow[]) {
  return rows.filter((row) => shouldSyncRow(name, row));
}

async function filterSyncableRowsForCloud(name: CollectionName, rows: AnyRow[]): Promise<AnyRow[]> {
  const basicRows = filterSyncableRows(name, rows);

  switch (name) {
    case "agent-runs":
    case "task-logs":
    case "quality-reviews":
    case "approvals": {
      const syncableTasks = filterSyncableRows("tasks", await readLocalCollection<AnyRow>("tasks"));
      const taskIds = new Set(syncableTasks.map((row) => String(row.id)));
      return basicRows.filter((row) => taskIds.has(String(getRowValue(row, "task_id", "taskId") ?? "")));
    }
    case "model-runs": {
      const syncableTasks = filterSyncableRows("tasks", await readLocalCollection<AnyRow>("tasks"));
      const syncableAgentRuns = await filterSyncableRowsForCloud("agent-runs", await readLocalCollection<AnyRow>("agent-runs"));
      const taskIds = new Set(syncableTasks.map((row) => String(row.id)));
      const agentRunIds = new Set(syncableAgentRuns.map((row) => String(row.id)));
      return basicRows.filter((row) => {
        const taskId = String(getRowValue(row, "task_id", "taskId") ?? "");
        const agentRunId = String(getRowValue(row, "agent_run_id", "agentRunId") ?? "");
        return taskIds.has(taskId) && agentRunIds.has(agentRunId);
      });
    }
    default:
      return basicRows;
  }
}

function mergeById<T extends { id: string }>(cloudRows: T[], localRows: T[]) {
  const localById = new Map(localRows.map((row) => [row.id, row]));
  const merged = cloudRows.map((row) => ({ ...row, ...(localById.get(row.id) ?? {}) }));
  const seen = new Set(merged.map((row) => row.id));
  for (const row of localRows) {
    if (!seen.has(row.id)) {
      merged.push(row);
    }
  }
  return merged;
}

function stripUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, current]) => current !== undefined)) as T;
}

function toCloudRow(name: CollectionName, row: AnyRow): AnyRow {
  const ownerId = getOwnerId();
  const base: AnyRow = { ...row, owner_id: row.owner_id ?? ownerId };
  const agentRef = getRowValue(base, "assigned_agent_id", "assignedAgentId", "agent_id", "agentId");
  const safeAgentId = isUuid(agentRef) ? agentRef : null;
  const reviewerRef = getRowValue(base, "reviewer_agent_id", "reviewerAgentId");
  const safeReviewerId = isUuid(reviewerRef) ? reviewerRef : null;
  const requestedByRef = getRowValue(base, "requested_by_agent_id", "requestedByAgentId", "agent_id");
  const safeRequestedById = isUuid(requestedByRef) ? requestedByRef : null;

  switch (name) {
    case "agents":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        department: base.department,
        title: base.title,
        manager_id: base.manager_id ?? base.managerId ?? null,
        model: base.model,
        prompt: base.prompt,
        tool_permissions: base.tool_permissions ?? base.toolPermissions ?? [],
        status: base.status ?? "idle",
        agent_role: base.agent_role ?? base.agentRole ?? "worker",
        skills: base.skills ?? [],
        workload: Number(base.workload ?? 0),
        model_policy_id: base.model_policy_id ?? base.modelPolicyId ?? null,
        preferred_model_policy: base.preferred_model_policy ?? base.preferredModelPolicy ?? null,
        preferred_provider: base.preferred_provider ?? base.preferredProvider ?? null,
        preferred_model: base.preferred_model ?? base.preferredModel ?? null,
        fallback_provider: base.fallback_provider ?? base.fallbackProvider ?? null,
        fallback_model: base.fallback_model ?? base.fallbackModel ?? null,
        max_cost_per_run: base.max_cost_per_run ?? base.maxCostPerRun ?? null,
        temperature: base.temperature ?? null,
        max_tokens: base.max_tokens ?? base.maxTokens ?? null,
        current_focus: base.current_focus ?? base.currentFocus ?? null,
        success_rate: Number(base.success_rate ?? base.successRate ?? 0),
        created_at: base.created_at ?? new Date().toISOString(),
        updated_at: base.updated_at ?? new Date().toISOString()
      });
    case "projects":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        client_name: base.client_name ?? base.clientName ?? "",
        objective: base.objective ?? "",
        client_profile: base.client_profile ?? base.clientProfile ?? "",
        progress: Number(base.progress ?? 0),
        stage: base.stage ?? "planning",
        due_date: base.due_date ?? base.dueDate ?? null,
        created_at: base.created_at ?? new Date().toISOString(),
        updated_at: base.updated_at ?? new Date().toISOString()
      });
    case "tasks":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        project_id: base.project_id ?? base.projectId ?? null,
        assigned_agent_id: safeAgentId,
        title: base.title,
        description: base.description,
        task_type: base.task_type ?? base.taskType ?? "general",
        priority: base.priority ?? "medium",
        risk_level: base.risk_level ?? base.riskLevel ?? "low",
        status: base.status ?? "todo",
        board_status: base.board_status ?? base.boardStatus ?? base.status ?? "todo",
        approval_status: base.approval_status ?? base.approvalStatus ?? "not_required",
        review_status: base.review_status ?? base.reviewStatus ?? "not_required",
        estimated_cost: Number(base.estimated_cost ?? base.estimatedCost ?? 0),
        actual_cost: Number(base.actual_cost ?? base.actualCost ?? 0),
        parent_task_id: base.parent_task_id ?? base.parentTaskId ?? null,
        sort_order: Number(base.sort_order ?? base.sortOrder ?? 0),
        due_at: base.due_at ?? base.dueAt ?? null,
        outputs: base.outputs ?? [],
        created_by: base.created_by ?? "owner",
        created_at: base.created_at ?? new Date().toISOString(),
        updated_at: base.updated_at ?? new Date().toISOString()
      });
    case "agent-runs":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        task_id: base.task_id ?? base.taskId ?? null,
        agent_id: safeAgentId,
        status: base.status ?? "queued",
        model: base.model ?? null,
        input: base.input ?? {},
        output: base.output ?? {},
        prompt_tokens: Number(base.prompt_tokens ?? base.promptTokens ?? 0),
        completion_tokens: Number(base.completion_tokens ?? base.completionTokens ?? 0),
        cost: Number(base.cost ?? 0),
        error: base.error ?? null,
        started_at: base.started_at ?? base.startedAt ?? null,
        finished_at: base.finished_at ?? base.finishedAt ?? null,
        created_at: base.created_at ?? new Date().toISOString()
      });
    case "model-runs":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        agent_run_id: base.agent_run_id ?? base.agentRunId ?? null,
        task_id: base.task_id ?? base.taskId ?? null,
        agent_id: safeAgentId,
        policy_name: base.policy_name ?? base.policyName ?? null,
        provider: base.provider ?? null,
        model: base.model ?? null,
        input_tokens: Number(base.input_tokens ?? base.inputTokens ?? 0),
        output_tokens: Number(base.output_tokens ?? base.outputTokens ?? 0),
        estimated_cost: Number(base.estimated_cost ?? base.estimatedCost ?? 0),
        latency_ms: Number(base.latency_ms ?? base.latencyMs ?? 0),
        status: base.status ?? "success",
        error: base.error ?? null,
        created_at: base.created_at ?? new Date().toISOString()
      });
    case "task-logs":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        task_id: base.task_id ?? base.taskId ?? null,
        agent_id: safeAgentId,
        run_id: base.run_id ?? base.runId ?? null,
        type: base.type ?? "action",
        content: base.content ?? "",
        metadata: base.metadata ?? {},
        created_at: base.created_at ?? new Date().toISOString()
      });
    case "quality-reviews":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        task_id: base.task_id ?? base.taskId ?? null,
        reviewer_agent_id: safeReviewerId,
        status: base.status ?? "pending",
        score: base.score ?? null,
        checklist: base.checklist ?? [],
        notes: base.notes ?? null,
        created_at: base.created_at ?? new Date().toISOString(),
        decided_at: base.decided_at ?? base.decidedAt ?? null
      });
    case "approvals":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        task_id: base.task_id ?? base.taskId ?? null,
        requested_by_agent_id: safeRequestedById,
        status: base.status ?? "pending",
        reason: base.reason ?? base.decision_note ?? "Workflow approval record",
        decision_note: base.decision_note ?? base.decisionNote ?? null,
        decided_at: base.decided_at ?? base.decidedAt ?? null,
        created_at: base.created_at ?? new Date().toISOString()
      });
    default:
      return base;
  }
}

async function readSupabaseRows(name: CollectionName): Promise<AnyRow[]> {
  const supabase = getSupabase();
  const ownerId = getOwnerId();
  const config = cloudConfig[name];
  if (!supabase || !ownerId || !config) return [];

  const query = supabase.from(config.table).select("*").eq("owner_id", ownerId).order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) {
    throw new Error(`Failed to read ${config.table} from Supabase: ${error.message}`);
  }
  return (data ?? []) as AnyRow[];
}

async function deleteSupabaseRowsMissing(name: CollectionName, nextIds: string[]) {
  const supabase = getSupabase();
  const ownerId = getOwnerId();
  const config = cloudConfig[name];
  if (!supabase || !ownerId || !config) return;

  const existing = await readSupabaseRows(name);
  const staleIds = existing.map((row) => String(row.id)).filter((id) => !nextIds.includes(id));
  if (!staleIds.length) return;

  const { error } = await supabase.from(config.table).delete().eq("owner_id", ownerId).in("id", staleIds);
  if (error) {
    throw new Error(`Failed to delete stale ${config.table} rows from Supabase: ${error.message}`);
  }
}

async function upsertSupabaseRows(name: CollectionName, rows: AnyRow[]) {
  const supabase = getSupabase();
  const config = cloudConfig[name];
  if (!supabase || !config || !rows.length) return;

  const payload = rows.map((row) => {
    const cloudRow = toCloudRow(name, row);
    return Object.fromEntries(config.columns.filter((column) => column in cloudRow).map((column) => [column, cloudRow[column]]));
  });

  const { error } = await supabase.from(config.table).upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(`Failed to upsert ${config.table} to Supabase: ${error.message}`);
  }
}

async function replaceSupabaseCollection(name: CollectionName, rows: AnyRow[]) {
  if (!isCloudBacked(name)) return;
  const syncableRows = await filterSyncableRowsForCloud(name, rows);
  await deleteSupabaseRowsMissing(
    name,
    syncableRows.map((row) => String(row.id))
  );
  if (syncableRows.length) {
    await upsertSupabaseRows(name, syncableRows);
  }
}

async function seedSupabaseFromLocal() {
  if (!getSupabase() || !getOwnerId()) return;

  for (const name of cloudSeedOrder) {
    const remoteRows = await readSupabaseRows(name);
    if (remoteRows.length) continue;
    const localRows = await readLocalCollection<AnyRow>(name);
    const syncableRows = await filterSyncableRowsForCloud(name, localRows);
    if (!syncableRows.length) continue;
    await upsertSupabaseRows(name, syncableRows);
  }
}

async function ensureCloudSeeded() {
  if (!getSupabase() || !getOwnerId()) return;
  if (!cloudSeedPromise) {
    cloudSeedPromise = seedSupabaseFromLocal().catch((error) => {
      cloudSeedPromise = null;
      throw error;
    });
  }
  await cloudSeedPromise;
}

export async function readCollection<T>(name: CollectionName): Promise<T[]> {
  const localRows = await readLocalCollection<T>(name);
  if (!isCloudBacked(name)) {
    return localRows;
  }

  try {
    await ensureCloudSeeded();
    const cloudRows = (await readSupabaseRows(name)) as T[];
    const syncableLocalRows = (await filterSyncableRowsForCloud(name, localRows as AnyRow[])) as T[];
    return mergeById(cloudRows as Array<{ id: string }>, syncableLocalRows as Array<{ id: string }>) as T[];
  } catch (error) {
    markCloudUnavailable();
    console.warn(`[local-store] Supabase read failed for ${name}; using local data only.`, error);
    return localRows;
  }
}

export async function writeCollection<T>(name: CollectionName, data: T[]) {
  await writeLocalCollection(name, data);
  if (isCloudBacked(name)) {
    try {
      await ensureCloudSeeded();
      await replaceSupabaseCollection(name, data as AnyRow[]);
    } catch (error) {
      markCloudUnavailable();
      console.warn(`[local-store] Supabase write failed for ${name}; local data was saved.`, error);
    }
  }
}

export async function appendCollectionItem<T extends { id: string }>(name: CollectionName, item: T) {
  const rows = await readLocalCollection<T>(name);
  rows.unshift(item);
  await writeLocalCollection(name, rows);

  if (isCloudBacked(name) && shouldSyncRow(name, item as AnyRow)) {
    try {
      await ensureCloudSeeded();
      await upsertSupabaseRows(name, [item as AnyRow]);
    } catch (error) {
      markCloudUnavailable();
      console.warn(`[local-store] Supabase append failed for ${name}; local data was saved.`, error);
    }
  }
  return item;
}

export async function patchCollectionItem<T extends { id: string }>(
  name: CollectionName,
  id: string,
  patch: Partial<T>
) {
  const rows = await readLocalCollection<T>(name);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const next = { ...rows[index], ...patch } as T;
  rows[index] = next;
  await writeLocalCollection(name, rows);

  if (isCloudBacked(name) && shouldSyncRow(name, next as AnyRow)) {
    try {
      await ensureCloudSeeded();
      await upsertSupabaseRows(name, [next as AnyRow]);
    } catch (error) {
      markCloudUnavailable();
      console.warn(`[local-store] Supabase patch failed for ${name}; local data was saved.`, error);
    }
  }
  return next;
}

export async function upsertByField<T extends Record<string, unknown>>(
  name: CollectionName,
  field: keyof T,
  value: unknown,
  record: T
) {
  const rows = await readLocalCollection<T>(name);
  const index = rows.findIndex((row) => row[field] === value);
  if (index === -1) {
    rows.unshift(record);
  } else {
    rows[index] = { ...rows[index], ...record };
  }
  await writeLocalCollection(name, rows);

  if (isCloudBacked(name)) {
    try {
      await ensureCloudSeeded();
      await replaceSupabaseCollection(name, rows as AnyRow[]);
    } catch (error) {
      markCloudUnavailable();
      console.warn(`[local-store] Supabase upsert failed for ${name}; local data was saved.`, error);
    }
  }
  return record;
}
