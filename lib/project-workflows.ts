import { writeCollection, readCollection } from "@/lib/local-store";

export async function syncSiteGenerationState(projectId: string, files: string[]) {
  const projects = await readCollection<any>("projects");
  const tasks = await readCollection<any>("tasks");

  const nextProjects = projects.map((project) =>
    project.id === projectId
      ? {
          ...project,
          progress: 56,
          stage: "execution",
          updated_at: new Date().toISOString()
        }
      : project
  );

  const now = new Date().toISOString();
  const fileSummary = files.join(", ");

  const nextTasks = tasks.map((task) => {
    if (task.projectId !== projectId && task.project_id !== projectId) return task;

    if (task.id === "task-b2b-001") {
      return patchTask(task, now, {
        status: "done",
        boardStatus: "done",
        board_status: "done",
        reviewStatus: "approved",
        review_status: "approved",
        outputs: ensureOutput(task.outputs, {
          agentId: "agent-exec",
          content: "MVP 范围已锁定为项目创建、模板生成、页面内容、HTML 输出和发布前准备。",
          createdAt: now
        })
      });
    }

    if (task.id === "task-b2b-002") {
      return patchTask(task, now, {
        status: "done",
        boardStatus: "done",
        board_status: "done",
        reviewStatus: "approved",
        review_status: "approved",
        outputs: ensureOutput(task.outputs, {
          agentId: "agent-market",
          content: "行业模板、公司资料、目标市场和示例产品数据已整理完成，可直接供页面生成调用。",
          createdAt: now
        })
      });
    }

    if (task.id === "task-b2b-003") {
      return patchTask(task, now, {
        status: "done",
        boardStatus: "done",
        board_status: "done",
        reviewStatus: "approved",
        review_status: "approved",
        outputs: ensureOutput(task.outputs, {
          agentId: "agent-exec",
          content: `六个页面的结构化内容与 SEO 信息已生成，输出文件包括：${fileSummary}。`,
          createdAt: now
        })
      });
    }

    if (task.id === "task-b2b-004") {
      return patchTask(task, now, {
        status: "review",
        boardStatus: "review",
        board_status: "review",
        reviewStatus: "pending",
        review_status: "pending",
        outputs: ensureOutput(task.outputs, {
          agentId: "agent-ops",
          content: "HTML 页面已生成并落盘，当前等待页面可视化验收。",
          createdAt: now
        })
      });
    }

    if (task.id === "task-b2b-006") {
      return patchTask(task, now, {
        status: "in_progress",
        boardStatus: "in_progress",
        board_status: "in_progress",
        outputs: ensureOutput(task.outputs, {
          agentId: "agent-product",
          content: "示例项目已经完成本地真实跑通，正在整理 MVP 验收结论与后续补齐项。",
          createdAt: now
        })
      });
    }

    return task;
  });

  await writeCollection("projects", nextProjects);
  await writeCollection("tasks", nextTasks);
}

export function shouldTriggerSiteGeneration(goal: string, projectId?: string | null) {
  const normalized = goal.toLowerCase();
  return (
    Boolean(projectId === "project-ai-b2b-site-builder-mvp") &&
    ["建站", "初稿", "html", "页面", "site", "wordpress"].some((keyword) => normalized.includes(keyword))
  );
}

function ensureOutput(
  outputs: Array<{ agentId: string; content: string; createdAt: string }> | undefined,
  entry: { agentId: string; content: string; createdAt: string }
) {
  const current = Array.isArray(outputs) ? outputs : [];
  if (current.some((item) => item.content === entry.content)) return current;
  return [...current, entry];
}

function patchTask(task: any, updatedAt: string, patch: Record<string, unknown>) {
  return {
    ...task,
    ...patch,
    updated_at: updatedAt
  };
}
