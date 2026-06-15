import { fail, ok, parseJson } from "@/lib/api";
import { createProjectFromGoal, createTasksForProject, runProjectCycle } from "@/lib/workflow-engine";

type CommandBody = {
  goal?: string;
  project_id?: string | null;
  projectId?: string | null;
};

export const dynamic = "force-dynamic";

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
    const autoRuns = createdTasks.length ? await runProjectCycle(project.id, 3) : [];

    return ok(
      {
        project,
        brief,
        created_tasks: createdTasks,
        tasks: createdTasks,
        suggested_agents: suggestedAgents,
        risks,
        next_action: autoRuns.length ? "首轮任务已自动执行，去项目详情查看结果、日志和交付物。" : nextAction,
        auto_executed_runs: autoRuns
      },
      { status: 201 }
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "command failed", 500);
  }
}
