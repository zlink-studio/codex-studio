import { fail, ok, parseJson } from "@/lib/api";
import { createProjectFromGoal, createTasksForProject, runProjectToCompletion } from "@/lib/workflow-engine";

type CommandBody = {
  goal?: string;
  project_id?: string | null;
  projectId?: string | null;
};

export const dynamic = "force-dynamic";
// Model calls can run long; 60s is the ceiling that works on every Vercel plan.
export const maxDuration = 60;

export async function POST(request: Request) {
  const body = await parseJson<CommandBody>(request);
  if (!body?.goal?.trim()) return fail("goal is required");

  try {
    const goal = body.goal.trim();
    const { project, brief } = await createProjectFromGoal({
      goal,
      projectId: body.project_id ?? body.projectId ?? null
    });
    const { createdTasks, suggestedAgents, risks, nextAction } = await createTasksForProject({
      project,
      goal
    });

    // A project can produce large deliverables, so the API returns quickly after
    // creation and starts a bounded background cycle for the first execution pass.
    const willExecute = createdTasks.length > 0;
    if (willExecute) {
      void runProjectToCompletion(project.id, { cycleLimit: 3 }).catch((error) => {
        console.error(`[command] background execution failed for project ${project.id}:`, error);
      });
    }

    return ok(
      {
        project,
        brief,
        created_tasks: createdTasks,
        tasks: createdTasks,
        suggested_agents: suggestedAgents,
        risks,
        executing: willExecute,
        next_action: willExecute
          ? "项目已创建，AI 团队正在后台执行首轮任务。进入项目详情可查看实时进度、日志和交付物。"
          : nextAction
      },
      { status: 201 }
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "command failed", 500);
  }
}
