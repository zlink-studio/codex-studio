"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Bot, CheckCircle2, ClipboardList } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import { normalizeAgent, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents, dailyReport as fallbackReport, projects as fallbackProjects, tasks as fallbackTasks } from "@/lib/mock-data";
import type { Agent, DailyReport, Project, Task } from "@/lib/types";

export function DashboardWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);
  const [tasks, setTasks] = useState<Task[]>(fallbackTasks);
  const [report, setReport] = useState<DailyReport>(fallbackReport);
  const [message, setMessage] = useState("已加载本地示例数据");
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((response) => readApiData<any[]>(response)),
      fetch("/api/projects").then((response) => readApiData<any[]>(response)),
      fetch("/api/tasks").then((response) => readApiData<any[]>(response)),
      fetch("/api/daily-reports").then((response) => readApiData<any>(response))
    ])
      .then(([agentRows, projectRows, taskRows, reportRows]) => {
        setAgents(agentRows.map(normalizeAgent));
        setProjects(projectRows.map(normalizeProject));
        setTasks(taskRows.map(normalizeTask));
        setReport(normalizeReport(Array.isArray(reportRows) ? reportRows[0] : reportRows));
        setMessage("已连接 Dashboard API");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const pendingApprovals = tasks.filter((task) => task.approvalStatus === "pending");
  const riskTasks = tasks.filter((task) => task.riskLevel === "high" || task.riskLevel === "critical");
  const averageProgress = projects.length > 0 ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length) : 0;

  async function generateReport() {
    setIsGeneratingReport(true);
    setMessage("正在生成今日日报...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/daily-reports/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ report_date: new Date().toISOString().slice(0, 10) })
        })
      );
      setReport(normalizeReport(data));
      setMessage(data.persisted === false ? "已生成日报草案" : "日报已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "日报生成失败");
    } finally {
      setIsGeneratingReport(false);
    }
  }

  async function decideApproval(taskId: string, status: "approved" | "rejected") {
    setMessage(status === "approved" ? "正在批准任务..." : "正在拒绝任务...");

    try {
      await readApiData<any>(
        await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId, status })
        })
      );
      setTasks((current) => current.map((task) => (task.id === taskId ? { ...task, approvalStatus: status } : task)));
      setMessage(status === "approved" ? "任务已批准" : "任务已拒绝");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="今日经营驾驶舱"
        description="把老板需要知道的事压缩到一页：日报、审批、任务进度、员工负载和风险。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="待审批事项" value={`${pendingApprovals.length}`} detail="高风险任务会自动进入老板审批队列。" icon={CheckCircle2} />
        <MetricCard label="进行中任务" value={`${tasks.filter((task) => task.status === "in_progress").length}`} detail="执行经理会持续追踪阻塞点。" icon={ClipboardList} />
        <MetricCard label="项目平均进度" value={`${averageProgress}%`} detail="来自所有客户项目的综合进展。" icon={Bot} />
        <MetricCard label="风险提醒" value={`${riskTasks.length}`} detail="包含 high 与 critical 风险等级。" icon={AlertTriangle} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title={`今日日报 · ${report.reportDate}`} description={report.summary}>
          <div className="mb-4">
            <button
              className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-60"
              onClick={generateReport}
              disabled={isGeneratingReport}
            >
              {isGeneratingReport ? "生成中..." : "生成今日日报"}
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <ReportList title="完成" items={report.wins} />
            <ReportList title="风险" items={report.risks} />
            <ReportList title="下一步" items={report.nextActions} />
          </div>
        </Panel>

        <Panel title="员工状态" description="按当前工作焦点查看负载。">
          <div className="space-y-4">
            {agents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between gap-4 border-b border-line pb-3 last:border-0 last:pb-0">
                <div>
                  <p className="font-medium text-ink">{agent.name}</p>
                  <p className="mt-1 text-sm text-moss">{agent.currentFocus || agent.title}</p>
                </div>
                <StatusBadge value={agent.status} />
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title="任务进度" description="项目级进度，用于判断是否需要重新分配 Agent。">
          <div className="space-y-5">
            {projects.map((project) => (
              <div key={project.id}>
                <div className="mb-2 flex items-center justify-between gap-4">
                  <p className="font-medium text-ink">{project.name}</p>
                  <span className="text-sm font-semibold text-moss">{project.progress}%</span>
                </div>
                <ProgressBar value={project.progress} />
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="待审批与风险任务" description="高风险任务必须先过老板审批，再触发外部工具或客户动作。">
          {pendingApprovals.length > 0 && (
            <div className="mb-5 space-y-3">
              {pendingApprovals.map((task) => (
                <div key={task.id} className="flex flex-col justify-between gap-3 rounded-md border border-line bg-paper p-3 md:flex-row md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-ink">{task.title}</p>
                    <p className="mt-1 text-xs text-moss">风险等级：{task.riskLevel}</p>
                  </div>
                  <div className="flex gap-2">
                    <button className="rounded-md bg-moss px-3 py-2 text-xs font-semibold text-paper" onClick={() => decideApproval(task.id, "approved")}>
                      批准
                    </button>
                    <button className="rounded-md border border-line px-3 py-2 text-xs font-semibold text-moss" onClick={() => decideApproval(task.id, "rejected")}>
                      拒绝
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-moss">
                  <th className="pb-3 pr-4 font-semibold">任务</th>
                  <th className="pb-3 pr-4 font-semibold">负责人</th>
                  <th className="pb-3 pr-4 font-semibold">项目</th>
                  <th className="pb-3 pr-4 font-semibold">风险</th>
                  <th className="pb-3 pr-4 font-semibold">审批</th>
                  <th className="pb-3 font-semibold">状态</th>
                </tr>
              </thead>
              <tbody>{riskTasks.map((task) => <TaskRow key={task.id} task={task} agents={agents} projects={projects} />)}</tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}

function normalizeReport(row: any): DailyReport {
  if (!row) return fallbackReport;
  return {
    id: row.id,
    reportDate: row.reportDate ?? row.report_date,
    summary: row.summary,
    wins: row.wins ?? [],
    risks: row.risks ?? [],
    nextActions: row.nextActions ?? row.next_actions ?? []
  };
}

function ReportList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-ink">{title}</h3>
      <ul className="space-y-2 text-sm leading-6 text-moss">
        {items.map((item) => (
          <li key={item}>• {item}</li>
        ))}
      </ul>
    </div>
  );
}
