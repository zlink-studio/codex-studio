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

const seedApprovals = seedTasks
  .filter((task) => task.approvalStatus === "pending")
  .map((task) => ({
    id: `approval-${task.id}`,
    task_id: task.id,
    status: "pending",
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

function filePath(name: CollectionName) {
  return path.join(dataDir, `${name}.json`);
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

export async function readCollection<T>(name: CollectionName): Promise<T[]> {
  const target = await ensureCollection(name);
  const raw = await fs.readFile(target, "utf8");
  return JSON.parse(raw) as T[];
}

export async function writeCollection<T>(name: CollectionName, data: T[]) {
  const target = await ensureCollection(name);
  await fs.writeFile(target, JSON.stringify(data, null, 2), "utf8");
}

export async function appendCollectionItem<T extends { id: string }>(name: CollectionName, item: T) {
  const rows = await readCollection<T>(name);
  rows.unshift(item);
  await writeCollection(name, rows);
  return item;
}

export async function patchCollectionItem<T extends { id: string }>(
  name: CollectionName,
  id: string,
  patch: Partial<T>
) {
  const rows = await readCollection<T>(name);
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;

  const next = { ...rows[index], ...patch } as T;
  rows[index] = next;
  await writeCollection(name, rows);
  return next;
}

export async function upsertByField<T extends Record<string, unknown>>(
  name: CollectionName,
  field: keyof T,
  value: unknown,
  record: T
) {
  const rows = await readCollection<T>(name);
  const index = rows.findIndex((row) => row[field] === value);
  if (index === -1) {
    rows.unshift(record);
  } else {
    rows[index] = { ...rows[index], ...record };
  }
  await writeCollection(name, rows);
  return record;
}
