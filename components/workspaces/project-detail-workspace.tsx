"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Download, PlayCircle, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ProgressBar } from "@/components/progress-bar";
import { StatusBadge } from "@/components/status-badge";
import { readApiData } from "@/lib/client-normalizers";
import type { Deliverable, Project, ProjectLog, Task } from "@/lib/types";

type ProjectDetailResponse = {
  project: Project;
  tasks: Task[];
  deliverables: Deliverable[];
  projectLogs: ProjectLog[];
  taskLogs: Array<Record<string, any>>;
  agentRuns: Array<Record<string, any>>;
  modelRuns: Array<Record<string, any>>;
  skillRuns: Array<Record<string, any>>;
  metrics: {
    total: number;
    done: number;
    inProgress: number;
    review: number;
    blocked: number;
    waitingBossApproval: number;
  };
  participatingAgents: Array<{
    agent: {
      id: string;
      name: string;
      title: string;
    };
    currentTask: Task | null;
    recentOutput: string | null;
  }>;
  highRiskTasks: Task[];
  blockedTasks: Task[];
  pendingApprovalTasks: Task[];
};

export function ProjectDetailWorkspace({ projectId }: { projectId: string }) {
  const [detail, setDetail] = useState<ProjectDetailResponse | null>(null);
  const [message, setMessage] = useState("正在加载项目详情...");
  const [busy, setBusy] = useState<"next" | "cycle" | string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await readApiData<ProjectDetailResponse>(
        await fetch(`/api/projects/${projectId}/detail`)
      );
      setDetail(data);
      setMessage("项目详情已同步。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const project = detail?.project;
  const latestAgentRun = detail?.agentRuns?.[0] ?? null;
  const latestReview = detail?.projectLogs.find((log) => log.eventType === "review_completed") ?? null;

  const taskTimeline = useMemo(() => (detail?.projectLogs ?? []).slice(0, 12), [detail?.projectLogs]);

  async function runTask(taskId: string) {
    setBusy(taskId);
    setMessage("正在执行任务...");
    try {
      await readApiData<any>(
        await fetch("/api/agent-runs/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: taskId })
        })
      );
      await loadData();
      setMessage("任务执行完成，已写入日志和交付物。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setBusy(null);
    }
  }

  async function runNextTask() {
    setBusy("next");
    setMessage("正在执行下一条任务...");
    try {
      await readApiData<any>(await fetch(`/api/projects/${projectId}/run-next`, { method: "POST" }));
      await loadData();
      setMessage("已执行下一条任务。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setBusy(null);
    }
  }

  async function runProjectCycle() {
    setBusy("cycle");
    setMessage("正在运行项目周期...");
    try {
      await readApiData<any>(await fetch(`/api/projects/${projectId}/run-cycle`, { method: "POST" }));
      await loadData();
      setMessage("本轮项目周期已执行完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setBusy(null);
    }
  }

  if (!project || !detail) {
    return (
      <Panel>
        <div className="space-y-3">
          <p className="text-lg font-semibold text-ink">没有找到这个项目</p>
          <p className="text-sm text-moss">{message}</p>
          <Link href="/projects" className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper">
            <ArrowLeft size={16} />
            返回项目中心
          </Link>
        </div>
      </Panel>
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Project Detail"
        title={project.name}
        description="从项目 brief、任务推进、员工执行、交付物到风险审批，这里展示完整闭环。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => void runNextTask()}
              disabled={busy !== null}
              className="rounded-full border border-line/70 bg-paper px-4 py-2 text-sm font-semibold text-moss disabled:opacity-60"
            >
              Run Next Task
            </button>
            <button
              type="button"
              onClick={() => void runProjectCycle()}
              disabled={busy !== null}
              className="rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              Run Project Cycle
            </button>
            <Link
              href="/projects"
              className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper px-4 py-2 text-sm font-semibold text-moss"
            >
              <ArrowLeft size={16} />
              返回项目中心
            </Link>
          </div>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-6">
          <Panel title="Project Brief" description={project.brief ?? "当前项目已进入执行链路。"}>
            <div className="grid gap-4 md:grid-cols-2">
              <Detail label="项目名称" value={project.name} />
              <Detail label="客户背景" value={project.clientProfile || "暂无"} />
              <Detail label="项目目标" value={project.objective} />
              <Detail label="当前阶段" value={project.stage} />
              <Detail label="风险等级" value={project.riskLevel ?? "low"} />
              <Detail label="截止时间" value={project.dueDate ?? "未设置"} />
            </div>
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium text-ink">项目进度</span>
                <span className="text-moss">{project.progress}%</span>
              </div>
              <ProgressBar value={project.progress} />
            </div>
          </Panel>

          <Panel title="Execution Overview" description={message}>
            <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
              <Metric label="总任务数" value={detail.metrics.total} />
              <Metric label="已完成" value={detail.metrics.done} />
              <Metric label="执行中" value={detail.metrics.inProgress} />
              <Metric label="Review 中" value={detail.metrics.review} />
              <Metric label="Blocked" value={detail.metrics.blocked} />
              <Metric label="待老板审批" value={detail.metrics.waitingBossApproval} />
            </div>
          </Panel>

          <Panel title="Task Timeline" description="按时间展示项目内最近发生的任务事件。">
            <div className="space-y-3">
              {taskTimeline.map((log) => (
                <div key={log.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="font-semibold text-ink">{log.title}</p>
                      <p className="mt-1 text-sm leading-6 text-moss">{log.description}</p>
                    </div>
                    <span className="text-xs text-moss">{formatTime(log.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <SmallCard
                title="最近一次 Agent 执行"
                value={
                  latestAgentRun
                    ? `${latestAgentRun.agent_id ?? "-"} / ${formatTime(latestAgentRun.finished_at ?? latestAgentRun.created_at)}`
                    : "暂无"
                }
              />
              <SmallCard
                title="最近一次审核"
                value={latestReview ? `${latestReview.title} / ${formatTime(latestReview.createdAt)}` : "暂无"}
              />
            </div>
          </Panel>

          <Panel title="Deliverables" description="所有重要输出都会写入 deliverables，并保存到 outputs 目录。">
            {detail.deliverables.length === 0 ? (
              <EmptyState text="当前还没有交付物。" />
            ) : (
              <div className="space-y-3">
                {detail.deliverables.map((item) => (
                  <div key={item.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-ink">{item.title}</p>
                        <p className="mt-1 text-sm text-moss">
                          类型：{item.type} · 关联任务：{item.taskId ?? "无"} · 生成时间：{formatTime(item.createdAt)}
                        </p>
                        <p className="mt-2 break-all text-xs text-moss">{item.filePath ?? "文本交付物"}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge value={item.status === "approved" ? "done" : item.status === "review" ? "review" : "todo"} label={item.status} />
                        <a
                          className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper px-4 py-2 text-sm font-semibold text-moss"
                          href={`/api/deliverables/${item.id}/download`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Download size={14} />
                          查看 / 下载
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="任务列表" description="可以直接在项目页运行单条任务。">
            <div className="space-y-3">
              {detail.tasks.map((task) => (
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
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void runTask(task.id)}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      <PlayCircle size={15} />
                      {busy === task.id ? "执行中..." : "Run Task"}
                    </button>
                  </div>
                  {task.result ? (
                    <div className="mt-3 rounded-[20px] bg-[#fbfcf8] p-3 text-sm leading-6 text-moss">
                      {task.result}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Agent Activity" description="哪些 Agent 参与了项目、当前任务是什么、最近产出了什么。">
            <div className="space-y-3">
              {detail.participatingAgents.map((row) => (
                <div key={row.agent.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-ink">{row.agent.name}</p>
                      <p className="mt-1 text-sm text-moss">{row.agent.title}</p>
                    </div>
                    <span className="text-xs text-moss">{row.currentTask?.title ?? "当前无任务"}</span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-moss">{row.recentOutput ?? "暂无最近产出"}</p>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Risks & Decisions" description="高风险任务、Blocked 任务和待老板确认事项都集中在这里。">
            <div className="space-y-4">
              <RiskBlock title="高风险任务" tasks={detail.highRiskTasks} />
              <RiskBlock title="Blocked 任务" tasks={detail.blockedTasks} />
              <RiskBlock title="待老板确认事项" tasks={detail.pendingApprovalTasks} />
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-2 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function SmallCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-moss">{value}</p>
    </div>
  );
}

function RiskBlock({ title, tasks }: { title: string; tasks: Task[] }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink">
        <ShieldAlert size={15} />
        {title}
      </div>
      {tasks.length === 0 ? (
        <EmptyState text="当前没有相关事项。" />
      ) : (
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="rounded-[20px] border border-line/70 bg-paper/45 p-3">
              <p className="font-medium text-ink">{task.title}</p>
              <p className="mt-1 text-sm leading-6 text-moss">{task.description}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-6 text-sm text-moss">
      {text}
    </div>
  );
}

function formatTime(value?: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("zh-CN");
}
