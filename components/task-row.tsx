import { StatusBadge } from "@/components/status-badge";
import type { Agent, Project, Task } from "@/lib/types";

const taskTypeLabels: Record<string, string> = {
  general: "通用任务",
  code: "代码开发",
  content: "内容生产",
  automation: "自动化",
  review: "复核检查",
  data: "数据处理"
};

export function TaskRow({
  task,
  agents,
  projects
}: {
  task: Task;
  agents: Agent[];
  projects: Project[];
}) {
  const agent = agents.find((item) => item.id === task.assignedAgentId);
  const project = projects.find((item) => item.id === task.projectId);

  return (
    <tr className="border-b border-line/70 last:border-0">
      <td className="py-4 pr-4 align-top">
        <p className="font-medium text-ink">{task.title}</p>
        <p className="mt-1 max-w-xl text-sm leading-6 text-moss">
          {task.taskType ? `${taskTypeLabels[task.taskType] ?? task.taskType} / ` : ""}
          {task.description}
        </p>
        {!!task.suggestedSkills?.length && (
          <div className="mt-2 flex flex-wrap gap-2">
            {task.suggestedSkills.map((skill) => (
              <span
                key={skill}
                className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-medium text-[#4257a6] dark:bg-white/8 dark:text-[#b7c4ff]"
              >
                {skill}
              </span>
            ))}
          </div>
        )}
      </td>
      <td className="py-4 pr-4 text-sm text-moss">{agent?.name ?? "未分配"}</td>
      <td className="py-4 pr-4 text-sm text-moss">{project?.name ?? "无项目"}</td>
      <td className="py-4 pr-4">
        <StatusBadge value={task.riskLevel} />
      </td>
      <td className="py-4 pr-4">
        <StatusBadge value={task.approvalStatus} />
      </td>
      <td className="py-4">
        <StatusBadge value={task.status} />
      </td>
    </tr>
  );
}
