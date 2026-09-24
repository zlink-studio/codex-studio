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
import { getWritableRoot } from "@/lib/storage-paths";

const dataDir = path.join(getWritableRoot(), "work", "local-data");

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
      "brief",
      "progress",
      "stage",
      "risk_level",
      "due_date",
      "agent_ids",
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
      "assigned_agent_role",
      "suggested_skills",
      "model_policy",
      "priority",
      "risk_level",
      "status",
      "board_status",
      "approval_status",
      "approval_level",
      "approval_required",
      "review_status",
      "input_requirements",
      "output_requirements",
      "result",
      "estimated_cost",
      "actual_cost",
      "parent_task_id",
      "sort_order",
      "due_at",
      "outputs",
      "used_memory_ids",
      "model_run",
      "rework_count",
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
      "subject_type",
      "subject_id",
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
  },
  skills: {
    table: "skills",
    columns: [
      "id",
      "owner_id",
      "name",
      "slug",
      "category",
      "description",
      "instructions",
      "input_schema",
      "output_schema",
      "risk_level",
      "skill_type",
      "required_tools",
      "required_memory_types",
      "approval_required",
      "approval_level",
      "source",
      "source_url",
      "license",
      "version",
      "enabled",
      "created_at",
      "updated_at"
    ]
  },
  "agent-skills": {
    table: "agent_skills",
    columns: ["id", "owner_id", "agent_id", "skill_id", "priority", "enabled", "config", "created_at", "updated_at"]
  },
  "skill-runs": {
    table: "skill_runs",
    columns: [
      "id",
      "owner_id",
      "skill_id",
      "agent_id",
      "task_id",
      "agent_run_id",
      "model_run_id",
      "status",
      "input",
      "output",
      "error",
      "latency_ms",
      "created_at"
    ]
  },
  "skill-reviews": {
    table: "skill_reviews",
    columns: ["id", "owner_id", "skill_id", "review_status", "risk_notes", "reviewed_by", "reviewed_at", "created_at"]
  },
  deliverables: {
    table: "deliverables",
    columns: [
      "id",
      "owner_id",
      "project_id",
      "task_id",
      "agent_id",
      "title",
      "type",
      "file_path",
      "content",
      "status",
      "created_at",
      "updated_at"
    ]
  },
  "project-logs": {
    table: "project_logs",
    columns: [
      "id",
      "owner_id",
      "project_id",
      "event_type",
      "title",
      "description",
      "related_task_id",
      "related_agent_id",
      "related_deliverable_id",
      "created_at"
    ]
  },
  "daily-reports": {
    table: "daily_reports",
    columns: ["id", "owner_id", "report_date", "summary", "wins", "risks", "next_actions", "content_metrics", "created_at"]
  }
};

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

export function isLocalStoreEnabled() {
  return process.env.USE_LOCAL_STORE === "true";
}

function requireCloudBacked(name: CollectionName) {
  if (!cloudConfig[name]) {
    throw new Error(`Collection ${name} is not configured for Supabase storage.`);
  }
  if (!getSupabase()) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY, or explicitly set USE_LOCAL_STORE=true for offline development."
    );
  }
  if (!getOwnerId()) {
    throw new Error("DEMO_OWNER_ID is required when Supabase storage is enabled.");
  }
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
        brief: base.brief ?? null,
        progress: Number(base.progress ?? 0),
        stage: base.stage ?? "planning",
        risk_level: base.risk_level ?? base.riskLevel ?? "low",
        due_date: base.due_date ?? base.dueDate ?? null,
        agent_ids: base.agent_ids ?? base.agentIds ?? [],
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
        assigned_agent_role: base.assigned_agent_role ?? base.assignedAgentRole ?? null,
        suggested_skills: base.suggested_skills ?? base.suggestedSkills ?? [],
        model_policy: base.model_policy ?? base.modelPolicy ?? null,
        priority: base.priority ?? "medium",
        risk_level: base.risk_level ?? base.riskLevel ?? "low",
        status: base.status ?? "todo",
        board_status: base.board_status ?? base.boardStatus ?? base.status ?? "todo",
        approval_status: base.approval_status ?? base.approvalStatus ?? "not_required",
        approval_level: base.approval_level ?? base.approvalLevel ?? "L0",
        approval_required: Boolean(base.approval_required ?? base.approvalRequired ?? false),
        review_status: base.review_status ?? base.reviewStatus ?? "not_required",
        input_requirements: base.input_requirements ?? base.inputRequirements ?? null,
        output_requirements: base.output_requirements ?? base.outputRequirements ?? null,
        result: base.result ?? null,
        estimated_cost: Number(base.estimated_cost ?? base.estimatedCost ?? 0),
        actual_cost: Number(base.actual_cost ?? base.actualCost ?? 0),
        parent_task_id: base.parent_task_id ?? base.parentTaskId ?? null,
        sort_order: Number(base.sort_order ?? base.sortOrder ?? 0),
        due_at: base.due_at ?? base.dueAt ?? null,
        outputs: base.outputs ?? [],
        used_memory_ids: base.used_memory_ids ?? base.usedMemoryIds ?? [],
        model_run: base.model_run ?? base.modelRun ?? null,
        rework_count: Number(base.rework_count ?? base.reworkCount ?? 0),
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
        run_id: isUuid(base.run_id ?? base.runId) ? (base.run_id ?? base.runId) : null,
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
        subject_type: base.subject_type ?? base.subjectType ?? "task",
        subject_id: base.subject_id ?? base.subjectId ?? base.task_id ?? base.taskId ?? null,
        requested_by_agent_id: safeRequestedById,
        status: base.status ?? "pending",
        reason: base.reason ?? base.decision_note ?? "Workflow approval record",
        decision_note: base.decision_note ?? base.decisionNote ?? null,
        decided_at: base.decided_at ?? base.decidedAt ?? null,
        created_at: base.created_at ?? new Date().toISOString()
      });
    case "skills":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        slug: base.slug,
        category: base.category ?? "management",
        description: base.description ?? "",
        instructions: base.instructions ?? "",
        input_schema: base.input_schema ?? base.inputSchema ?? null,
        output_schema: base.output_schema ?? base.outputSchema ?? null,
        risk_level: base.risk_level ?? base.riskLevel ?? "low",
        skill_type: base.skill_type ?? base.skillType ?? "knowledge",
        required_tools: base.required_tools ?? base.requiredTools ?? [],
        required_memory_types: base.required_memory_types ?? base.requiredMemoryTypes ?? [],
        approval_required: Boolean(base.approval_required ?? base.approvalRequired ?? false),
        approval_level: base.approval_level ?? base.approvalLevel ?? "L0",
        source: base.source ?? "custom",
        source_url: base.source_url ?? base.sourceUrl ?? null,
        license: base.license ?? null,
        version: base.version ?? null,
        enabled: base.enabled ?? true,
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString(),
        updated_at: base.updated_at ?? base.updatedAt ?? new Date().toISOString()
      });
    case "agent-skills":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        agent_id: base.agent_id ?? base.agentId,
        skill_id: base.skill_id ?? base.skillId,
        priority: base.priority ?? "secondary",
        enabled: base.enabled ?? true,
        config: base.config ?? null,
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString(),
        updated_at: base.updated_at ?? base.updatedAt ?? new Date().toISOString()
      });
    case "skill-runs":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        skill_id: base.skill_id ?? base.skillId,
        agent_id: base.agent_id ?? base.agentId ?? null,
        task_id: base.task_id ?? base.taskId ?? null,
        agent_run_id: base.agent_run_id ?? base.agentRunId ?? null,
        model_run_id: base.model_run_id ?? base.modelRunId ?? null,
        status: base.status ?? "success",
        input: base.input ?? null,
        output: base.output ?? null,
        error: base.error ?? null,
        latency_ms: Number(base.latency_ms ?? base.latencyMs ?? 0),
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString()
      });
    case "skill-reviews":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        skill_id: base.skill_id ?? base.skillId,
        review_status: base.review_status ?? base.reviewStatus ?? "pending",
        risk_notes: base.risk_notes ?? base.riskNotes ?? null,
        reviewed_by: base.reviewed_by ?? base.reviewedBy ?? null,
        reviewed_at: base.reviewed_at ?? base.reviewedAt ?? null,
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString()
      });
    case "deliverables":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        project_id: base.project_id ?? base.projectId,
        task_id: base.task_id ?? base.taskId ?? null,
        agent_id: base.agent_id ?? base.agentId ?? null,
        title: base.title,
        type: base.type ?? "text",
        file_path: base.file_path ?? base.filePath ?? null,
        content: base.content ?? null,
        status: base.status ?? "draft",
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString(),
        updated_at: base.updated_at ?? base.updatedAt ?? new Date().toISOString()
      });
    case "project-logs":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        project_id: base.project_id ?? base.projectId,
        event_type: base.event_type ?? base.eventType ?? "task_completed",
        title: base.title ?? "",
        description: base.description ?? "",
        related_task_id: base.related_task_id ?? base.relatedTaskId ?? null,
        related_agent_id: base.related_agent_id ?? base.relatedAgentId ?? null,
        related_deliverable_id: base.related_deliverable_id ?? base.relatedDeliverableId ?? null,
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString()
      });
    case "daily-reports":
      return stripUndefined({
        id: base.id,
        owner_id: base.owner_id,
        report_date: base.report_date ?? base.reportDate ?? new Date().toISOString().slice(0, 10),
        summary: base.summary ?? "",
        wins: base.wins ?? [],
        risks: base.risks ?? [],
        next_actions: base.next_actions ?? base.nextActions ?? [],
        content_metrics: base.content_metrics ?? base.contentMetrics ?? {},
        created_at: base.created_at ?? base.createdAt ?? new Date().toISOString()
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
  requireCloudBacked(name);
  const syncableRows = rows;
  await deleteSupabaseRowsMissing(
    name,
    syncableRows.map((row) => String(row.id))
  );
  if (syncableRows.length) {
    await upsertSupabaseRows(name, syncableRows);
  }
}

export async function readCollection<T>(name: CollectionName): Promise<T[]> {
  if (isLocalStoreEnabled()) return readLocalCollection<T>(name);

  requireCloudBacked(name);
  return (await readSupabaseRows(name)) as T[];
}

export async function writeCollection<T>(name: CollectionName, data: T[]) {
  if (isLocalStoreEnabled()) {
    await writeLocalCollection(name, data);
    return;
  }

  requireCloudBacked(name);
  await replaceSupabaseCollection(name, data as AnyRow[]);
}

export async function appendCollectionItem<T extends { id: string }>(name: CollectionName, item: T) {
  if (isLocalStoreEnabled()) {
    const rows = await readLocalCollection<T>(name);
    rows.unshift(item);
    await writeLocalCollection(name, rows);
    return item;
  }

  requireCloudBacked(name);
  await upsertSupabaseRows(name, [item as AnyRow]);
  return item;
}

export async function patchCollectionItem<T extends { id: string }>(
  name: CollectionName,
  id: string,
  patch: Partial<T>
) {
  let rows: T[];
  if (isLocalStoreEnabled()) {
    rows = await readLocalCollection<T>(name);
  } else {
    requireCloudBacked(name);
    rows = (await readSupabaseRows(name)) as T[];
  }
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const next = { ...rows[index], ...patch } as T;
  if (isLocalStoreEnabled()) {
    rows[index] = next;
    await writeLocalCollection(name, rows);
  } else {
    await upsertSupabaseRows(name, [next as AnyRow]);
  }
  return next;
}

export async function upsertByField<T extends Record<string, unknown>>(
  name: CollectionName,
  field: keyof T,
  value: unknown,
  record: T
) {
  let rows: T[];
  if (isLocalStoreEnabled()) {
    rows = await readLocalCollection<T>(name);
  } else {
    requireCloudBacked(name);
    rows = (await readSupabaseRows(name)) as T[];
  }
  const index = rows.findIndex((row) => row[field] === value);
  if (index === -1) {
    rows.unshift(record);
  } else {
    rows[index] = { ...rows[index], ...record };
  }
  const saved = rows[index === -1 ? 0 : index];
  if (isLocalStoreEnabled()) {
    await writeLocalCollection(name, rows);
  } else {
    await upsertSupabaseRows(name, [saved as AnyRow]);
  }
  return saved;
}
