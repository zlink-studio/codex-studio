import { StatusBadge } from "@/components/status-badge";
import type { Agent, Project, Task } from "@/lib/types";

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
    <tr className="border-b border-line last:border-0">
      <td className="py-4 pr-4 align-top">
        <p className="font-medium text-ink">{task.title}</p>
        <p className="mt-1 max-w-xl text-sm leading-5 text-moss">
          {task.taskType ? `${task.taskType} · ` : ""}
          {task.description}
        </p>
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
