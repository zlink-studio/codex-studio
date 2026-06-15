"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, FileOutput } from "lucide-react";
import { MetricCard } from "@/components/metric-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import type { Deliverable, Project, Task } from "@/lib/types";

type OwnerInbox = {
  pendingApprovals: any[];
  blockedTasks: any[];
  todayDone: any[];
  recentDeliverables: Array<Deliverable & { projectName?: string }>;
  highRiskItems: any[];
};

export function DashboardWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [inbox, setInbox] = useState<OwnerInbox>({
    pendingApprovals: [],
    blockedTasks: [],
    todayDone: [],
    recentDeliverables: [],
    highRiskItems: []
  });
  const [message, setMessage] = useState("正在加载总控台...");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    try {
      const [projectRows, ownerInbox] = await Promise.all([
        fetch("/api/projects").then((response) => readApiData<any[]>(response)),
        fetch("/api/owner-inbox").then((response) => readApiData<OwnerInbox>(response))
      ]);
      setProjects(projectRows.map(normalizeProject));
      setInbox(ownerInbox);
      setMessage("总控台已连接真实本地执行数据。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }

  const averageProgress =
    projects.length > 0
      ? Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
      : 0;

  return (
    <>
      <PageHeader
        eyebrow="Dashboard"
        title="经营总控台"
        description="这里只看真实数据：待审批、阻塞、今日完成和最近交付物。"
        action={
          <span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">
            {message}
          </span>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="待老板审批" value={`${inbox.pendingApprovals.length}`} detail="高风险任务优先看" icon={CheckCircle2} />
        <MetricCard label="已阻塞任务" value={`${inbox.blockedTasks.length}`} detail="需要解除卡点" icon={AlertTriangle} />
        <MetricCard label="今日完成" value={`${inbox.todayDone.length}`} detail="当天已交付闭环" icon={ClipboardList} />
        <MetricCard label="项目平均进度" value={`${averageProgress}%`} detail="自动按任务状态计算" icon={FileOutput} />
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="待审批任务" description="这些任务已经有结果，但还不能继续，需要老板点头。">
          <TaskList tasks={inbox.pendingApprovals.map(normalizeTask)} empty="当前没有待审批任务。" />
        </Panel>

        <Panel title="已阻塞任务" description="这些任务卡住了，通常需要补资料、调整策略或重新决策。">
          <TaskList tasks={inbox.blockedTasks.map(normalizeTask)} empty="当前没有阻塞任务。" />
        </Panel>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Panel title="今日完成任务" description="今天已经完成的任务，会在这里汇总出来。">
          <TaskList tasks={inbox.todayDone.map(normalizeTask)} empty="今天还没有完成任务。" />
        </Panel>

        <Panel title="最近交付物" description="最新落地的 deliverables 都会出现在这里。">
          {inbox.recentDeliverables.length === 0 ? (
            <EmptyState text="还没有新的交付物。" />
          ) : (
            <div className="space-y-3">
              {inbox.recentDeliverables.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-ink">{item.title}</p>
                      <p className="mt-1 text-sm text-moss">{item.projectName ?? item.projectId}</p>
                    </div>
                    <StatusBadge value={item.status === "review" ? "review" : item.status === "approved" ? "done" : "todo"} label={item.status} />
                  </div>
                  <p className="mt-2 text-xs text-moss">{item.filePath ?? "文本交付物"}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="高风险事项" description="这些事项需要重点关注，不会自动执行外部动作。">
          <TaskList tasks={inbox.highRiskItems.map(normalizeTask)} empty="当前没有高风险事项。" />
        </Panel>
      </section>
    </>
  );
}

function TaskList({ tasks, empty }: { tasks: Task[]; empty: string }) {
  if (tasks.length === 0) return <EmptyState text={empty} />;

  return (
    <div className="space-y-3">
      {tasks.map((task) => (
        <div key={task.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="font-semibold text-ink">{task.title}</p>
              <p className="mt-1 text-sm leading-6 text-moss">{task.description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusBadge value={task.riskLevel} />
              <StatusBadge value={task.approvalStatus} />
              <StatusBadge value={task.boardStatus ?? task.status} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-8 text-center text-sm text-moss">
      {text}
    </div>
  );
}
