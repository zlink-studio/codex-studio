import { ok, resolveOwnerId } from "@/lib/api";
import { readCollection } from "@/lib/local-store";
import { createSupabaseServerClient } from "@/lib/supabase";

type AnyRow = Record<string, any>;

const runnableStatuses = new Set(["todo", "in_progress"]);
const reviewStatuses = new Set(["review", "waiting_boss_approval"]);
const blockedStatuses = new Set(["blocked"]);
const doneStatuses = new Set(["done", "delivered"]);

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));

  const [projects, tasks, agents, deliverables, projectLogs, taskLogs] = await Promise.all([
    readCollection<AnyRow>("projects"),
    readCollection<AnyRow>("tasks"),
    readCollection<AnyRow>("agents"),
    readCollection<AnyRow>("deliverables"),
    readCollection<AnyRow>("project-logs"),
    readCollection<AnyRow>("task-logs")
  ]);

  const memories = await readMemoryRows(ownerId);
  const approvedMemories = memories.filter((memory) => (memory.status ?? "approved") === "approved");
  const pendingMemories = memories.filter((memory) => (memory.status ?? "approved") === "pending_review");
  const activeProjects = projects.filter((project) => !doneStatuses.has(project.stage));
  const runnableTasks = tasks.filter((task) => runnableStatuses.has(statusOf(task)));
  const reviewTasks = tasks.filter((task) => reviewStatuses.has(statusOf(task)));
  const blockedTasks = tasks.filter((task) => blockedStatuses.has(statusOf(task)));
  const recentDeliverables = [...deliverables]
    .sort((a, b) => dateMs(b.created_at ?? b.createdAt) - dateMs(a.created_at ?? a.createdAt))
    .slice(0, 5);

  return ok({
    chiefAgent: {
      name: "Chief Agent",
      title: "公司中枢大脑",
      mode: "自动创建项目、拆解任务、分配员工并执行；外部动作和高风险动作保留确认机制。",
      status: runnableTasks.length ? "running" : "ready"
    },
    operatingMode: {
      localFirst: true,
      cloudSync: Boolean(createSupabaseServerClient()),
      agentMemoryPlanned: true,
      externalActionsRequireConfirm: true
    },
    metrics: {
      projects: projects.length,
      activeProjects: activeProjects.length,
      runnableTasks: runnableTasks.length,
      reviewTasks: reviewTasks.length,
      blockedTasks: blockedTasks.length,
      deliverables: deliverables.length,
      approvedMemories: approvedMemories.length,
      pendingMemories: pendingMemories.length,
      agents: agents.length
    },
    memoryMap: buildMemoryMap(memories),
    missionQueue: buildMissionQueue(projects, tasks),
    activeAgents: agents.slice(0, 8).map((agent) => ({
      id: agent.id,
      name: agent.name,
      title: agent.title,
      role: agent.agent_role ?? agent.agentRole ?? "worker",
      status: agent.status ?? "idle",
      focus: agent.current_focus ?? agent.currentFocus ?? ""
    })),
    recentDeliverables,
    recentEvents: [...projectLogs, ...taskLogs]
      .sort((a, b) => dateMs(b.created_at ?? b.createdAt) - dateMs(a.created_at ?? a.createdAt))
      .slice(0, 8)
  });
}

async function readMemoryRows(ownerId: string | null) {
  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) return [];

  const { data } = await supabase
    .from("memories")
    .select("id,title,type,scope,status,importance,updated_at")
    .eq("owner_id", ownerId)
    .order("updated_at", { ascending: false })
    .limit(300);
  return data ?? [];
}

function buildMemoryMap(memories: AnyRow[]) {
  const types = ["company", "client", "project", "agent", "sop", "review"];
  return types.map((type) => ({
    type,
    count: memories.filter((memory) => memory.type === type).length,
    approved: memories.filter((memory) => memory.type === type && (memory.status ?? "approved") === "approved").length
  }));
}

function buildMissionQueue(projects: AnyRow[], tasks: AnyRow[]) {
  return projects
    .map((project) => {
      const projectTasks = tasks.filter((task) => (task.project_id ?? task.projectId) === project.id);
      const runnable = projectTasks.filter((task) => runnableStatuses.has(statusOf(task)));
      const done = projectTasks.filter((task) => doneStatuses.has(statusOf(task)));
      return {
        id: project.id,
        name: project.name,
        objective: project.objective,
        progress: calculateProjectProgress(projectTasks, project.progress),
        stage: project.stage ?? "planning",
        totalTasks: projectTasks.length,
        doneTasks: done.length,
        nextTask: runnable[0]?.title ?? null
      };
    })
    .filter((project) => project.totalTasks > 0 || project.progress < 100)
    .sort((a, b) => b.progress - a.progress)
    .slice(0, 6);
}

function statusOf(row: AnyRow) {
  return row.status ?? row.board_status ?? "todo";
}

function calculateProjectProgress(tasks: AnyRow[], fallback?: number) {
  if (!tasks.length) return Number(fallback ?? 0);
  const weights: Record<string, number> = {
    done: 100,
    delivered: 100,
    review: 70,
    waiting_boss_approval: 70,
    in_progress: 40,
    todo: 10,
    backlog: 0,
    blocked: 0
  };
  const total = tasks.reduce((sum, task) => sum + (weights[statusOf(task)] ?? 0), 0);
  return Math.round(total / tasks.length);
}

function dateMs(value?: string | null) {
  return value ? new Date(value).getTime() || 0 : 0;
}
