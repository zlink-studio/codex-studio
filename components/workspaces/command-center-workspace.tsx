"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, ClipboardCheck, Database, Send, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { StatusBadge } from "@/components/status-badge";
import { normalizeAgent, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import type { Agent, Project, Task } from "@/lib/types";

type CommandResponse = {
  project: any;
  brief: {
    project_name: string;
    client_name: string;
    objective: string;
    client_profile: string;
    brief: string;
    risk_level: string;
    due_date?: string | null;
  };
  tasks: any[];
  created_tasks: any[];
  suggested_agents: string[];
  risks: string[];
  next_action: string;
};

const examples = [
  "做一个可跑通的 AI 外贸 B2B 自动建站 MVP，从拆解到交付物全部跑完。",
  "为一家工业设备出口公司做一份 LinkedIn 内容运营方案，给出第一周可发布的帖子草稿。",
  "把一个新客户项目从 brief、任务拆解、执行到交付物输出全部走一遍。"
];

export function CommandCenterWorkspace() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState("");
  const [goal, setGoal] = useState("");
  const [result, setResult] = useState<CommandResponse | null>(null);
  const [message, setMessage] = useState("等待老板下达目标。");
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    void loadContext();
  }, []);

  async function loadContext() {
    try {
      const [agentRows, projectRows] = await Promise.all([
        fetch("/api/agents").then((response) => readApiData<any[]>(response)),
        fetch("/api/projects").then((response) => readApiData<any[]>(response))
      ]);
      setAgents(agentRows.map(normalizeAgent));
      setProjects(projectRows.map(normalizeProject));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载上下文失败");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setResult(null);
    setMessage("正在生成项目 brief、创建任务并写入执行链路...");

    try {
      const data = await readApiData<CommandResponse>(
        await fetch("/api/command", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal,
            project_id: projectId || null
          })
        })
      );
      setResult(data);
      setMessage(`已创建 ${data.created_tasks.length} 条任务。下一步：${data.next_action}`);
      await loadContext();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="项目指挥台"
        description="你只需给出目标，系统会自动生成 brief、建项目、拆任务、逐条执行并由 AI 复核签批，直接把项目跑到完成。"
        action={
          <span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">
            {message}
          </span>
        }
      />

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel title="输入项目目标" description="可以关联现有项目，也可以直接把目标交给系统创建新项目。">
          <form className="space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-medium text-ink">关联项目</span>
              <select
                className="mt-2 w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">新建项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <textarea
              className="min-h-48 w-full rounded-[24px] border border-line/70 bg-paper/70 px-4 py-4 text-sm leading-6 outline-none focus:border-moss"
              placeholder="例如：做一个 AI 外贸 B2B 自动建站工具 MVP，先打通项目创建、页面生成、输出交付物和 Review Gate。"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              required
            />

            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-full border border-line/70 bg-paper/55 px-3 py-2 text-xs text-moss transition hover:border-moss hover:text-ink"
                  onClick={() => setGoal(example)}
                >
                  {example}
                </button>
              ))}
            </div>

            <button
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
              disabled={isRunning}
            >
              <Send size={16} />
              {isRunning ? "处理中..." : "启动项目工作流"}
            </button>
          </form>
        </Panel>

        <Panel title="执行结果" description="这里展示本轮生成的项目 brief、任务清单、风险项和下一步动作。">
          {result ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-4">
                <Metric icon={<ClipboardCheck size={16} />} label="任务数" value={`${result.created_tasks.length}`} />
                <Metric icon={<ShieldAlert size={16} />} label="风险项" value={`${result.risks.length}`} />
                <Metric icon={<Bot size={16} />} label="建议 Agent" value={`${result.suggested_agents.length}`} />
                <Metric icon={<Database size={16} />} label="项目状态" value={result.project.stage ?? "planning"} />
              </div>

              <Link
                href={`/projects/${result.project.id}`}
                className="flex items-center justify-between gap-3 rounded-[24px] bg-ink px-5 py-4 text-paper shadow-[0_16px_38px_rgba(15,23,42,0.18)] transition hover:opacity-95"
              >
                <span>
                  <span className="block text-sm font-semibold">项目已创建并开始执行</span>
                  <span className="mt-0.5 block text-xs text-paper/75">点击查看进度、执行日志和交付物</span>
                </span>
                <ArrowRight size={18} />
              </Link>

              <div className="rounded-[24px] border border-line/70 bg-paper/55 p-4">
                <p className="text-sm font-semibold text-ink">下一步建议</p>
                <p className="mt-2 text-sm leading-6 text-moss">{result.next_action}</p>
                {result.risks.length > 0 ? (
                  <ul className="mt-3 space-y-2 text-sm leading-6 text-moss">
                    {result.risks.map((risk) => (
                      <li key={risk}>- {risk}</li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <CollapsiblePanel title="项目简报" defaultOpen={false} className="!rounded-[24px]">
                <div className="space-y-2 text-sm leading-6 text-moss">
                  <p><span className="font-semibold text-ink">项目：</span>{result.brief.project_name}</p>
                  <p><span className="font-semibold text-ink">客户：</span>{result.brief.client_name}</p>
                  <p><span className="font-semibold text-ink">目标：</span>{result.brief.objective}</p>
                  <p><span className="font-semibold text-ink">背景：</span>{result.brief.client_profile}</p>
                  <p><span className="font-semibold text-ink">Brief：</span>{result.brief.brief}</p>
                </div>
              </CollapsiblePanel>

              <CollapsiblePanel
                title="任务拆解"
                description={`共 ${result.created_tasks.length} 条任务`}
                defaultOpen={false}
                className="!rounded-[24px]"
              >
                <div className="space-y-3">
                  {result.created_tasks.map((row) => {
                    const task = normalizeTask(row);
                    const agent = agents.find((item) => item.id === task.assignedAgentId);
                    return (
                      <article key={task.id} className="rounded-[20px] border border-line/70 bg-paper/55 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-ink">{task.title}</p>
                            <p className="mt-1 text-sm leading-6 text-moss">{task.description}</p>
                          </div>
                          <StatusBadge value={task.riskLevel} />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <Tag>{agent?.name ?? task.assignedAgentRole ?? "未分配"}</Tag>
                          <Tag>{task.modelPolicy ?? "default"}</Tag>
                          <StatusBadge value={task.boardStatus ?? task.status} />
                        </div>
                      </article>
                    );
                  })}
                </div>
              </CollapsiblePanel>
            </div>
          ) : (
            <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-6 text-sm leading-6 text-moss">
              这里会展示新创建的项目、brief、任务拆解结果，以及下一步推荐动作。
            </div>
          )}
        </Panel>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-moss">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[#e8efe4] px-2.5 py-1 text-xs font-medium text-moss">{children}</span>;
}
