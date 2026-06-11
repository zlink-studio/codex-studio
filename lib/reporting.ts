import { agents, projects, tasks } from "@/lib/mock-data";
import { createOpenAIClient, defaultModel } from "@/lib/openai";
import type { Agent, DailyReport, Project, Task } from "@/lib/types";

export async function generateDailyReport(input?: {
  reportDate?: string;
  agents?: Agent[];
  projects?: Project[];
  tasks?: Task[];
}): Promise<DailyReport> {
  const reportDate = input?.reportDate ?? new Date().toISOString().slice(0, 10);
  const sourceTasks = input?.tasks ?? tasks;
  const sourceAgents = input?.agents ?? agents;
  const sourceProjects = input?.projects ?? projects;
  const client = createOpenAIClient();

  if (!client) {
    return fallbackReport(reportDate, sourceTasks, sourceAgents, sourceProjects);
  }

  const response = await client.chat.completions.create({
    model: defaultModel,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: "你是一人公司执行经理 Agent。根据当天任务、员工和项目数据生成日报。只输出 JSON。"
      },
      {
        role: "user",
        content: JSON.stringify({
          reportDate,
          agents: sourceAgents,
          projects: sourceProjects,
          tasks: sourceTasks,
          schema: {
            summary: "string",
            wins: ["string"],
            risks: ["string"],
            nextActions: ["string"]
          }
        })
      }
    ]
  });

  try {
    const parsed = JSON.parse(response.choices[0]?.message.content ?? "{}") as Omit<DailyReport, "id" | "reportDate">;
    return {
      id: `report-${reportDate}`,
      reportDate,
      summary: parsed.summary,
      wins: parsed.wins ?? [],
      risks: parsed.risks ?? [],
      nextActions: parsed.nextActions ?? []
    };
  } catch {
    return fallbackReport(reportDate, sourceTasks, sourceAgents, sourceProjects);
  }
}

function fallbackReport(reportDate: string, sourceTasks: Task[], sourceAgents: Agent[], sourceProjects: Project[]): DailyReport {
  const doneTasks = sourceTasks.filter((task) => task.status === "done");
  const blockedTasks = sourceTasks.filter((task) => task.status === "blocked");
  const pendingApprovals = sourceTasks.filter((task) => task.approvalStatus === "pending");
  const activeProjects = sourceProjects.filter((project) => project.progress < 100);
  const busyAgents = sourceAgents.filter((agent) => agent.status === "busy");

  return {
    id: `report-${reportDate}`,
    reportDate,
    summary: `今日共跟进 ${sourceTasks.length} 个任务、${activeProjects.length} 个活跃项目，当前有 ${pendingApprovals.length} 个事项等待老板审批。`,
    wins: doneTasks.length > 0 ? doneTasks.map((task) => `完成：${task.title}`) : ["已完成今日经营数据同步与任务盘点"],
    risks: [
      ...pendingApprovals.map((task) => `待审批：${task.title}`),
      ...blockedTasks.map((task) => `阻塞：${task.title}`),
      ...busyAgents.map((agent) => `员工负载偏高：${agent.name}`)
    ].slice(0, 5),
    nextActions: [
      "处理待审批高风险任务",
      "检查阻塞任务并重新分配负责人",
      "让执行经理 Agent 更新明日优先级"
    ]
  };
}
