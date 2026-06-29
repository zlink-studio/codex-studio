"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileText,
  Loader2,
  LockKeyhole,
  Radio,
  Send,
  ShieldCheck,
  Sparkles,
  Workflow
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ProgressBar } from "@/components/progress-bar";
import { normalizeProject, readApiData } from "@/lib/client-normalizers";
import type { Project } from "@/lib/types";

type BrainOverview = {
  chiefAgent: {
    name: string;
    title: string;
    mode: string;
    status: "ready" | "running" | string;
  };
  operatingMode: {
    localFirst: boolean;
    cloudSync: boolean;
    agentMemoryPlanned: boolean;
    externalActionsRequireConfirm: boolean;
  };
  metrics: {
    projects: number;
    activeProjects: number;
    runnableTasks: number;
    reviewTasks: number;
    blockedTasks: number;
    deliverables: number;
    approvedMemories: number;
    pendingMemories: number;
    agents: number;
  };
  memoryMap: Array<{ type: string; count: number; approved: number }>;
  missionQueue: Array<{
    id: string;
    name: string;
    objective?: string | null;
    progress: number;
    stage: string;
    totalTasks: number;
    doneTasks: number;
    nextTask?: string | null;
  }>;
  activeAgents: Array<{
    id: string;
    name: string;
    title: string;
    role: string;
    status: string;
    focus?: string;
  }>;
};

const examples = [
  "为一家工业设备出口公司做 LinkedIn 获客增长计划，并产出第一周可发布内容。",
  "做一个 AI 外贸 B2B 自动建站 MVP，重点跑通项目创建、页面生成和交付物输出。",
  "整理当前项目的执行风险，给出下一步最应该做的 5 件事。",
  "把一个新客户 brief 变成完整项目，自动拆任务、分配员工并开始执行。"
];

const memoryTypeLabels: Record<string, string> = {
  company: "公司规则",
  client: "客户上下文",
  project: "项目经验",
  agent: "员工经验",
  sop: "SOP",
  review: "复盘"
};

export function HomeWorkspace() {
  const [overview, setOverview] = useState<BrainOverview | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [goal, setGoal] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [message, setMessage] = useState("中枢待命，可以直接下达目标。");
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  const activeProject = useMemo(
    () => projects.find((project) => project.progress < 100) ?? projects[0] ?? null,
    [projects]
  );

  async function refresh() {
    try {
      const [overviewData, projectRows] = await Promise.all([
        fetch("/api/company-brain/overview").then((response) => readApiData<BrainOverview>(response)),
        fetch("/api/projects").then((response) => readApiData<any[]>(response))
      ]);
      setOverview(overviewData);
      setProjects(projectRows.map(normalizeProject));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载公司中枢失败");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!goal.trim() || isRunning) return;

    setIsRunning(true);
    setCreatedProjectId(null);
    setMessage("Chief Agent 正在理解目标、调用记忆、创建项目并启动首轮执行。");

    try {
      const data = await readApiData<any>(
        await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal })
        })
      );
      setCreatedProjectId(data.project.id);
      setMessage(
        data.executing
          ? "项目已进入后台执行。进入项目详情可以查看任务、日志和交付物。"
          : data.next_action
      );
      setGoal("");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "中枢执行失败");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Company OS"
        title="公司中枢"
        description="把目标交给 Chief Agent。系统会调用公司记忆、创建项目、分配员工、执行任务并沉淀交付物；外部发布和高风险动作仍会等待确认。"
        action={<StatusPill running={isRunning || overview?.chiefAgent.status === "running"} text={message} />}
      />

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-6">
          <Panel className="p-5 sm:p-6">
            <div className="mb-5 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/65 px-3 py-1.5 text-xs font-semibold text-moss">
                  <BrainCircuit size={15} />
                  Chief Agent
                </div>
                <h3 className="mt-4 text-2xl font-semibold tracking-tight text-ink">今天让公司推进什么？</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-moss">
                  这里是唯一入口。你不用先选模块，中枢会判断该建项目、查记忆、拆任务、派员工，还是直接给结果。
                </p>
              </div>
              {activeProject ? (
                <Link
                  href={`/projects/${activeProject.id}`}
                  className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 px-4 py-2 text-sm font-semibold text-moss transition hover:border-moss hover:text-ink"
                >
                  继续当前项目
                  <ArrowRight size={16} />
                </Link>
              ) : null}
            </div>

            <form className="space-y-4" onSubmit={submit}>
              <textarea
                className="min-h-44 w-full resize-y rounded-[26px] border border-line/70 bg-paper/75 px-5 py-4 text-sm leading-6 text-ink outline-none transition placeholder:text-moss/70 focus:border-moss"
                placeholder="例如：为一家工业设备出口公司做 LinkedIn 获客增长计划，先跑通一周内容、线索路径和交付物。"
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                disabled={isRunning}
                required
              />

              <div className="flex flex-wrap gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    disabled={isRunning}
                    className="rounded-full border border-line/70 bg-paper/55 px-3 py-2 text-xs text-moss transition hover:border-moss hover:text-ink disabled:opacity-50"
                    onClick={() => setGoal(example)}
                  >
                    {example}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-paper shadow-[0_14px_32px_rgba(15,23,42,0.18)] disabled:opacity-60"
                  disabled={isRunning}
                >
                  {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  {isRunning ? "中枢正在接管..." : "下达目标"}
                </button>

                {createdProjectId ? (
                  <Link
                    href={`/projects/${createdProjectId}`}
                    className="inline-flex items-center gap-2 rounded-full bg-mint/70 px-4 py-3 text-sm font-semibold text-ink transition hover:bg-mint"
                  >
                    查看执行现场
                    <ArrowRight size={16} />
                  </Link>
                ) : null}
              </div>
            </form>
          </Panel>

          <Panel title="任务视图" description="中枢正在推进的项目队列。这里显示目标、进度、下一步，而不是后台配置。">
            <div className="space-y-3">
              {(overview?.missionQueue ?? []).length === 0 ? (
                <EmptyState text="当前没有执行中的项目。下达一个目标后，这里会出现任务队列。" />
              ) : (
                overview?.missionQueue.map((mission) => (
                  <Link
                    key={mission.id}
                    href={`/projects/${mission.id}`}
                    className="block rounded-[24px] border border-line/70 bg-paper/55 p-4 transition hover:border-moss hover:bg-paper/80"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">{mission.name}</p>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-moss">
                          {mission.objective || "暂无目标描述"}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-mint/55 px-3 py-1 text-xs font-semibold text-ink">
                        {mission.stage}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-moss">
                          {mission.doneTasks}/{mission.totalTasks} 任务完成
                        </span>
                        <span className="font-semibold text-ink">{mission.progress}%</span>
                      </div>
                      <ProgressBar value={mission.progress} />
                    </div>
                    <p className="mt-3 text-xs leading-5 text-moss">
                      下一步：{mission.nextTask ?? "等待中枢生成下一步动作"}
                    </p>
                  </Link>
                ))
              )}
            </div>
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="中枢模式" description={overview?.chiefAgent.mode ?? "正在读取运行模式。"}>
            <div className="grid gap-3 sm:grid-cols-2">
              <ModeCard icon={<LockKeyhole size={17} />} label="本地优先" active={overview?.operatingMode.localFirst ?? true} />
              <ModeCard icon={<Database size={17} />} label="云端同步" active={overview?.operatingMode.cloudSync ?? false} />
              <ModeCard icon={<BrainCircuit size={17} />} label="agentmemory 层" active={overview?.operatingMode.agentMemoryPlanned ?? true} />
              <ModeCard icon={<ShieldCheck size={17} />} label="外部动作确认" active={overview?.operatingMode.externalActionsRequireConfirm ?? true} />
            </div>
          </Panel>

          <Panel title="公司状态" description="中枢对公司事实账本和集体记忆的实时摘要。">
            <div className="grid grid-cols-2 gap-3">
              <Metric icon={<Workflow size={16} />} label="执行中任务" value={overview?.metrics.runnableTasks ?? 0} />
              <Metric icon={<CheckCircle2 size={16} />} label="复核中任务" value={overview?.metrics.reviewTasks ?? 0} />
              <Metric icon={<FileText size={16} />} label="交付物" value={overview?.metrics.deliverables ?? 0} />
              <Metric icon={<BrainCircuit size={16} />} label="已批准记忆" value={overview?.metrics.approvedMemories ?? 0} />
            </div>
          </Panel>

          <Panel title="公司大脑" description="Supabase 保存事实，agentmemory 负责经验召回。这里先展示可用的记忆地图。">
            <div className="space-y-2">
              {(overview?.memoryMap ?? []).map((item) => (
                <div key={item.type} className="rounded-[20px] border border-line/70 bg-paper/45 p-3">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium text-ink">{memoryTypeLabels[item.type] ?? item.type}</span>
                    <span className="text-xs text-moss">
                      {item.approved}/{item.count} 可召回
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line/50">
                    <div
                      className="h-full rounded-full bg-mint"
                      style={{ width: `${item.count ? Math.round((item.approved / item.count) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link
              href="/memory"
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/70 px-4 py-2 text-sm font-semibold text-moss transition hover:border-moss hover:text-ink"
            >
              打开公司大脑
              <ArrowRight size={15} />
            </Link>
          </Panel>

          <Panel title="数字员工" description="默认团队应该开箱即用，配置留到系统层。">
            <div className="space-y-2">
              {(overview?.activeAgents ?? []).slice(0, 5).map((agent) => (
                <div key={agent.id} className="rounded-[20px] border border-line/70 bg-paper/45 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">{agent.name}</p>
                      <p className="mt-0.5 text-xs text-moss">{agent.title}</p>
                    </div>
                    <span className="rounded-full bg-[#e8efe4] px-2.5 py-1 text-xs font-semibold text-moss">
                      {agent.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>
    </>
  );
}

function StatusPill({ running, text }: { running: boolean; text: string }) {
  return (
    <span className="inline-flex max-w-xl items-center gap-2 rounded-full border border-line/70 bg-paper/65 px-4 py-2 text-sm text-moss backdrop-blur-xl">
      {running ? <Loader2 size={15} className="animate-spin" /> : <Radio size={15} />}
      <span className="line-clamp-1">{text}</span>
    </span>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-[22px] border border-line/70 bg-paper/45 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-moss">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function ModeCard({ icon, label, active }: { icon: ReactNode; label: string; active: boolean }) {
  return (
    <div className="rounded-[22px] border border-line/70 bg-paper/45 p-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-ink">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xs text-moss">{active ? "已启用" : "待配置"}</p>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-6 text-sm text-moss">
      <Sparkles className="mb-3 text-moss" size={22} />
      {text}
    </div>
  );
}
