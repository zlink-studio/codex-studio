import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const dataDir = path.join(root, "work", "local-data");
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const collections = [
  "skills",
  "agent-skills",
  "skill-reviews",
  "agents",
  "projects",
  "tasks",
  "agent-runs",
  "model-runs",
  "skill-runs",
  "task-logs",
  "quality-reviews",
  "approvals",
  "deliverables",
  "project-logs"
];

const config = {
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
  "skill-reviews": {
    table: "skill_reviews",
    columns: ["id", "owner_id", "skill_id", "review_status", "risk_notes", "reviewed_by", "reviewed_at", "created_at"]
  },
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
  "task-logs": {
    table: "task_logs",
    columns: ["id", "owner_id", "task_id", "agent_id", "run_id", "type", "content", "metadata", "created_at"]
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
  }
};

const env = await readEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
const ownerId = env.DEMO_OWNER_ID;

if (!supabaseUrl || !serviceRoleKey || !ownerId) {
  throw new Error("Supabase env is incomplete. Check NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_OWNER_ID.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

const validTaskIds = new Set((await readRows("tasks")).filter((row) => isUuid(row.id)).map((row) => row.id));
const validAgentRunIds = new Set((await readRows("agent-runs")).filter((row) => isUuid(row.id)).map((row) => row.id));
const result = {};

for (const name of collections) {
  const rows = (await readRows(name)).filter((row) => shouldSync(name, row));
  if (!rows.length) {
    result[name] = 0;
    continue;
  }

  const payload = rows.map((row) => pickColumns(config[name].columns, toCloudRow(name, row, ownerId)));
  const { error } = await supabase.from(config[name].table).upsert(payload, { onConflict: "id" });
  if (error) {
    throw new Error(`${name} -> ${config[name].table}: ${error.message}`);
  }
  result[name] = payload.length;
}

console.log(JSON.stringify({ synced: true, result }, null, 2));

async function readEnv() {
  const raw = await readFile(path.join(root, ".env.local"), "utf8");
  const output = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    output[trimmed.slice(0, index)] = trimmed.slice(index + 1);
  }
  return output;
}

async function readRows(name) {
  try {
    return JSON.parse(await readFile(path.join(dataDir, `${name}.json`), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function isUuid(value) {
  return typeof value === "string" && uuidPattern.test(value);
}

function shouldSync(name, row) {
  if (!row?.id) return false;
  if (name === "agents") return isUuid(row.id);
  if (["projects", "tasks", "agent-runs", "model-runs", "task-logs", "quality-reviews", "approvals"].includes(name)) {
    if (!isUuid(row.id)) return false;
  }
  if (["tasks", "agent-runs", "model-runs", "task-logs", "quality-reviews", "approvals"].includes(name)) {
    const taskId = value(row, "task_id", "taskId", name === "tasks" ? "id" : "");
    if (taskId && !validTaskIds.has(taskId)) return false;
  }
  if (name === "model-runs" && !validAgentRunIds.has(value(row, "agent_run_id", "agentRunId"))) return false;
  return true;
}

function value(row, ...keys) {
  for (const key of keys) {
    if (key && row[key] !== undefined) return row[key];
  }
  return undefined;
}

function pickColumns(columns, row) {
  return Object.fromEntries(columns.filter((column) => row[column] !== undefined).map((column) => [column, row[column]]));
}

function safeUuid(value) {
  return isUuid(value) ? value : null;
}

function toCloudRow(name, row, ownerId) {
  const base = { ...row, owner_id: row.owner_id ?? ownerId };
  const agentRef = value(base, "assigned_agent_id", "assignedAgentId", "agent_id", "agentId");

  switch (name) {
    case "skills":
      return {
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        slug: base.slug,
        category: base.category ?? "management",
        description: base.description ?? "",
        instructions: base.instructions ?? "",
        input_schema: value(base, "input_schema", "inputSchema") ?? null,
        output_schema: value(base, "output_schema", "outputSchema") ?? null,
        risk_level: value(base, "risk_level", "riskLevel") ?? "low",
        skill_type: value(base, "skill_type", "skillType") ?? "knowledge",
        required_tools: value(base, "required_tools", "requiredTools") ?? [],
        required_memory_types: value(base, "required_memory_types", "requiredMemoryTypes") ?? [],
        approval_required: Boolean(value(base, "approval_required", "approvalRequired") ?? false),
        source: base.source ?? "custom",
        source_url: value(base, "source_url", "sourceUrl") ?? null,
        license: base.license ?? null,
        version: base.version ?? null,
        enabled: base.enabled ?? true,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "agent-skills":
      return {
        id: base.id,
        owner_id: base.owner_id,
        agent_id: value(base, "agent_id", "agentId"),
        skill_id: value(base, "skill_id", "skillId"),
        priority: base.priority ?? "secondary",
        enabled: base.enabled ?? true,
        config: base.config ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "skill-reviews":
      return {
        id: base.id,
        owner_id: base.owner_id,
        skill_id: value(base, "skill_id", "skillId"),
        review_status: value(base, "review_status", "reviewStatus") ?? "pending",
        risk_notes: value(base, "risk_notes", "riskNotes") ?? null,
        reviewed_by: value(base, "reviewed_by", "reviewedBy") ?? null,
        reviewed_at: value(base, "reviewed_at", "reviewedAt") ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "agents":
      return {
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        department: base.department,
        title: base.title,
        manager_id: safeUuid(value(base, "manager_id", "managerId")),
        model: base.model,
        prompt: base.prompt,
        tool_permissions: value(base, "tool_permissions", "toolPermissions") ?? [],
        status: base.status ?? "idle",
        agent_role: value(base, "agent_role", "agentRole") ?? "worker",
        skills: base.skills ?? [],
        workload: Number(base.workload ?? 0),
        model_policy_id: value(base, "model_policy_id", "modelPolicyId") ?? null,
        preferred_model_policy: value(base, "preferred_model_policy", "preferredModelPolicy") ?? null,
        preferred_provider: value(base, "preferred_provider", "preferredProvider") ?? null,
        preferred_model: value(base, "preferred_model", "preferredModel") ?? null,
        fallback_provider: value(base, "fallback_provider", "fallbackProvider") ?? null,
        fallback_model: value(base, "fallback_model", "fallbackModel") ?? null,
        max_cost_per_run: value(base, "max_cost_per_run", "maxCostPerRun") ?? null,
        temperature: base.temperature ?? null,
        max_tokens: value(base, "max_tokens", "maxTokens") ?? null,
        current_focus: value(base, "current_focus", "currentFocus") ?? null,
        success_rate: Number(value(base, "success_rate", "successRate") ?? 0),
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "projects":
      return {
        id: base.id,
        owner_id: base.owner_id,
        name: base.name,
        client_name: value(base, "client_name", "clientName") ?? "",
        objective: base.objective ?? "",
        client_profile: value(base, "client_profile", "clientProfile") ?? "",
        brief: base.brief ?? null,
        progress: Number(base.progress ?? 0),
        stage: base.stage ?? "planning",
        risk_level: value(base, "risk_level", "riskLevel") ?? "low",
        due_date: value(base, "due_date", "dueDate") ?? null,
        agent_ids: value(base, "agent_ids", "agentIds") ?? [],
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "tasks":
      return {
        id: base.id,
        owner_id: base.owner_id,
        project_id: value(base, "project_id", "projectId") ?? null,
        assigned_agent_id: safeUuid(agentRef),
        title: base.title,
        description: base.description,
        task_type: value(base, "task_type", "taskType") ?? "general",
        assigned_agent_role: value(base, "assigned_agent_role", "assignedAgentRole") ?? null,
        suggested_skills: value(base, "suggested_skills", "suggestedSkills") ?? [],
        model_policy: value(base, "model_policy", "modelPolicy") ?? null,
        priority: base.priority ?? "medium",
        risk_level: value(base, "risk_level", "riskLevel") ?? "low",
        status: base.status ?? "todo",
        board_status: value(base, "board_status", "boardStatus") ?? base.status ?? "todo",
        approval_status: value(base, "approval_status", "approvalStatus") ?? "not_required",
        approval_required: Boolean(value(base, "approval_required", "approvalRequired") ?? false),
        review_status: value(base, "review_status", "reviewStatus") ?? "not_required",
        input_requirements: value(base, "input_requirements", "inputRequirements") ?? null,
        output_requirements: value(base, "output_requirements", "outputRequirements") ?? null,
        result: base.result ?? null,
        estimated_cost: Number(value(base, "estimated_cost", "estimatedCost") ?? 0),
        actual_cost: Number(value(base, "actual_cost", "actualCost") ?? 0),
        parent_task_id: safeUuid(value(base, "parent_task_id", "parentTaskId")),
        sort_order: Number(value(base, "sort_order", "sortOrder") ?? 0),
        due_at: value(base, "due_at", "dueAt") ?? null,
        outputs: base.outputs ?? [],
        used_memory_ids: value(base, "used_memory_ids", "usedMemoryIds") ?? [],
        model_run: value(base, "model_run", "modelRun") ?? null,
        rework_count: Number(value(base, "rework_count", "reworkCount") ?? 0),
        created_by: value(base, "created_by", "createdBy") ?? "owner",
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "agent-runs":
      return {
        id: base.id,
        owner_id: base.owner_id,
        task_id: value(base, "task_id", "taskId") ?? null,
        agent_id: safeUuid(agentRef),
        status: base.status ?? "queued",
        model: base.model ?? null,
        input: base.input ?? {},
        output: base.output ?? {},
        prompt_tokens: Number(value(base, "prompt_tokens", "promptTokens") ?? 0),
        completion_tokens: Number(value(base, "completion_tokens", "completionTokens") ?? 0),
        cost: Number(base.cost ?? 0),
        error: base.error ?? null,
        started_at: value(base, "started_at", "startedAt") ?? null,
        finished_at: value(base, "finished_at", "finishedAt") ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "model-runs":
      return {
        id: base.id,
        owner_id: base.owner_id,
        agent_run_id: value(base, "agent_run_id", "agentRunId") ?? null,
        task_id: value(base, "task_id", "taskId") ?? null,
        agent_id: safeUuid(agentRef),
        policy_name: value(base, "policy_name", "policyName") ?? null,
        provider: base.provider ?? null,
        model: base.model ?? null,
        input_tokens: Number(value(base, "input_tokens", "inputTokens") ?? 0),
        output_tokens: Number(value(base, "output_tokens", "outputTokens") ?? 0),
        estimated_cost: Number(value(base, "estimated_cost", "estimatedCost") ?? 0),
        latency_ms: Number(value(base, "latency_ms", "latencyMs") ?? 0),
        status: base.status ?? "success",
        error: base.error ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "skill-runs":
      return {
        id: base.id,
        owner_id: base.owner_id,
        skill_id: value(base, "skill_id", "skillId"),
        agent_id: value(base, "agent_id", "agentId") ?? null,
        task_id: value(base, "task_id", "taskId") ?? null,
        agent_run_id: value(base, "agent_run_id", "agentRunId") ?? null,
        model_run_id: value(base, "model_run_id", "modelRunId") ?? null,
        status: base.status ?? "success",
        input: base.input ?? null,
        output: base.output ?? null,
        error: base.error ?? null,
        latency_ms: Number(value(base, "latency_ms", "latencyMs") ?? 0),
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "task-logs":
      return {
        id: base.id,
        owner_id: base.owner_id,
        task_id: value(base, "task_id", "taskId") ?? null,
        agent_id: safeUuid(agentRef),
        run_id: value(base, "run_id", "runId") ?? null,
        type: base.type ?? "action",
        content: base.content ?? "",
        metadata: base.metadata ?? {},
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "quality-reviews":
      return {
        id: base.id,
        owner_id: base.owner_id,
        task_id: value(base, "task_id", "taskId") ?? null,
        reviewer_agent_id: safeUuid(value(base, "reviewer_agent_id", "reviewerAgentId")),
        status: base.status ?? "pending",
        score: base.score ?? null,
        checklist: base.checklist ?? [],
        notes: base.notes ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        decided_at: value(base, "decided_at", "decidedAt") ?? null
      };
    case "approvals":
      return {
        id: base.id,
        owner_id: base.owner_id,
        task_id: value(base, "task_id", "taskId") ?? null,
        requested_by_agent_id: safeUuid(value(base, "requested_by_agent_id", "requestedByAgentId")),
        status: base.status ?? "pending",
        reason: base.reason ?? "Workflow approval record",
        decision_note: value(base, "decision_note", "decisionNote") ?? null,
        decided_at: value(base, "decided_at", "decidedAt") ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    case "deliverables":
      return {
        id: base.id,
        owner_id: base.owner_id,
        project_id: value(base, "project_id", "projectId"),
        task_id: value(base, "task_id", "taskId") ?? null,
        agent_id: value(base, "agent_id", "agentId") ?? null,
        title: base.title,
        type: base.type ?? "text",
        file_path: value(base, "file_path", "filePath") ?? null,
        content: base.content ?? null,
        status: base.status ?? "draft",
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString(),
        updated_at: value(base, "updated_at", "updatedAt") ?? new Date().toISOString()
      };
    case "project-logs":
      return {
        id: base.id,
        owner_id: base.owner_id,
        project_id: value(base, "project_id", "projectId"),
        event_type: value(base, "event_type", "eventType") ?? "task_completed",
        title: base.title ?? "",
        description: base.description ?? "",
        related_task_id: value(base, "related_task_id", "relatedTaskId") ?? null,
        related_agent_id: value(base, "related_agent_id", "relatedAgentId") ?? null,
        related_deliverable_id: value(base, "related_deliverable_id", "relatedDeliverableId") ?? null,
        created_at: value(base, "created_at", "createdAt") ?? new Date().toISOString()
      };
    default:
      return base;
  }
}
