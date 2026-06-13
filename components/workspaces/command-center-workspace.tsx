"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bot, ClipboardCheck, Database, Send, Sparkles, Workflow } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { normalizeAgent, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents } from "@/lib/mock-data";
import type { Agent, Memory, ModelRunSummary, Project, Task } from "@/lib/types";

type CommandResponse = {
  goal: string;
  summary?: string | null;
  tasks: any[];
  memoriesUsed?: Memory[];
  agentRun?: { id: string; status?: string; model?: string | null; error?: string | null };
  modelRun?: ModelRunSummary;
  persisted: boolean;
  warning?: string;
  manualBridgePrompt?: string | null;
};

const examples = [
  "把本周客户交付拆成可执行任务，并标记报价、合同和客户承诺风险。",
  "为新产品发布准备 7 天内容计划、销售跟进任务和日报检查点。",
  "复盘本月经营数据，找出现金流、交付和获客的三个优先改进动作。"
];

export function CommandCenterWorkspace() {
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [projects, setProjects] = useState<Project[]>([]);
  const [drafts, setDrafts] = useState<Task[]>([]);
  const [projectId, setProjectId] = useState("");
  const [goal, setGoal] = useState("");
  const [summary, setSummary] = useState("");
  const [memoriesUsed, setMemoriesUsed] = useState<Memory[]>([]);
  const [modelRun, setModelRun] = useState<ModelRunSummary | null>(null);
  const [agentRunStatus, setAgentRunStatus] = useState("");
  const [message, setMessage] = useState("等待老板输入目标");
  const [manualPrompt, setManualPrompt] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasResult, setHasResult] = useState(false);

  useEffect(() => {
    void loadContext();
  }, []);

  async function loadContext() {
    try {
      const [agentRows, projectRows] = await Promise.all([
        fetch("/api/agents").then((response) => readApiData<any[]>(response)),
        fetch("/api/projects").then((response) => readApiData<any[]>(response)).catch(() => [])
      ]);
      setAgents(agentRows.map(normalizeAgent));
      setProjects(projectRows.map(normalizeProject));
    } catch {
      setAgents(fallbackAgents);
    }
  }

  const executive = agents.find((agent) => agent.agentRole === "leader" || agent.department === "Executive") ?? agents[0];
  const pendingApprovalCount = useMemo(
    () => drafts.filter((task) => task.approvalStatus === "pending").length,
    [drafts]
  );
  const highRiskCount = useMemo(
    () => drafts.filter((task) => task.riskLevel === "high" || task.riskLevel === "critical").length,
    [drafts]
  );

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRunning(true);
    setHasResult(false);
    setManualPrompt(null);
    setSummary("");
    setMemoriesUsed([]);
    setModelRun(null);
    setAgentRunStatus("");
    setMessage("执行经理正在拆解任务...");

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

      const nextTasks = data.tasks.map(normalizeTask);
      setDrafts(nextTasks);
      setSummary(data.summary ?? "");
      setMemoriesUsed(data.memoriesUsed ?? []);
      setModelRun(data.modelRun ?? null);
      setAgentRunStatus(data.agentRun?.status ?? "");
      setManualPrompt(data.manualBridgePrompt ?? null);
      setHasResult(true);

      if (data.warning) {
        setMessage(`已使用降级方案：${data.warning}`);
      } else if (data.persisted) {
        setMessage(`已写入 ${nextTasks.length} 个任务到 Tasks`);
      } else {
        setMessage(`已生成 ${nextTasks.length} 个任务草稿`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "拆解失败");
    } finally {
      setIsRunning(false);
    }
  }

  async function triggerN8n() {
    setMessage("正在触发 n8n...");
    try {
      const data = await readApiData<{ triggered: boolean; reason?: string }>(
        await fetch("/api/n8n/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: goal || "manual-trigger", tasks: drafts })
        })
      );
      setMessage(data.triggered ? "n8n 已触发" : data.reason ?? "n8n 未配置");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "触发失败");
    }
  }

  async function copyManualPrompt() {
    if (!manualPrompt) return;
    await navigator.clipboard.writeText(manualPrompt);
    setMessage("已复制手动桥接 Prompt");
  }

  return (
    <>
      <PageHeader
        eyebrow="Command Center"
        title="老板指挥台"
        description="输入经营目标后，由执行经理 Agent 检索已审核记忆、拆解任务、识别审批风险，并写入 Tasks。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <Panel title="输入经营命令" description={`主持人：${executive?.name ?? "执行经理 Agent"}。高风险任务会进入老板审批。`}>
          <form className="space-y-4" onSubmit={submit}>
            <label className="block">
              <span className="text-sm font-medium text-ink">关联项目</span>
              <select
                className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss"
                value={projectId}
                onChange={(event) => setProjectId(event.target.value)}
              >
                <option value="">不关联项目</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>

            <textarea
              className="min-h-48 w-full rounded-md border border-line bg-paper px-4 py-3 text-sm leading-6 outline-none focus:border-moss"
              placeholder="例如：本周把 Aylahome 6 月社媒运营项目拆成可执行任务，并检查报价、合同和客户承诺风险。"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              required
            />

            <div className="flex flex-wrap gap-2">
              {examples.map((example) => (
                <button
                  key={example}
                  type="button"
                  className="rounded-md border border-line bg-[#fbfcf8] px-3 py-1.5 text-xs text-moss hover:border-moss hover:text-ink"
                  onClick={() => setGoal(example)}
                >
                  {example}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                disabled={isRunning}
              >
                <Send size={16} />
                {isRunning ? "拆解中..." : "提交给执行经理"}
              </button>
              <button
                type="button"
                onClick={triggerN8n}
                className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-moss"
              >
                <Workflow size={16} />
                触发 n8n Webhook
              </button>
              {manualPrompt && (
                <button
                  type="button"
                  onClick={copyManualPrompt}
                  className="inline-flex items-center gap-2 rounded-md border border-line px-4 py-2 text-sm font-semibold text-moss"
                >
                  复制手动桥接 Prompt
                </button>
              )}
            </div>
          </form>
        </Panel>

        <Panel title="拆解结果" description="任务、审批风险、模型运行和记忆引用会在这里汇总。">
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <Metric icon={<ClipboardCheck size={16} />} label="任务" value={`${drafts.length}`} />
              <Metric icon={<Sparkles size={16} />} label="高风险" value={`${highRiskCount}`} />
              <Metric icon={<Database size={16} />} label="用到记忆" value={`${memoriesUsed.length}`} />
            </div>

            {hasResult && (
              <div className="rounded-md border border-line bg-paper p-4">
                <p className="text-sm font-semibold text-ink">执行摘要</p>
                <p className="mt-2 text-sm leading-6 text-moss">{summary || "执行经理已完成拆解。"}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {agentRunStatus && <Tag>{agentRunStatus}</Tag>}
                  {modelRun && <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{modelRun.provider} / {modelRun.model}</span>}
                  {modelRun?.estimatedCost !== undefined && (
                    <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">
                      约 ${modelRun.estimatedCost.toFixed(5)}
                    </span>
                  )}
                  {pendingApprovalCount > 0 && <StatusBadge value="pending" />}
                </div>
              </div>
            )}

            {drafts.length > 0 ? (
              <div className="space-y-3">
                {drafts.map((task) => {
                  const agent = agents.find((item) => item.id === task.assignedAgentId);
                  return (
                    <article key={task.id} className="rounded-md border border-line bg-paper p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Bot size={16} className="text-moss" />
                          <p className="font-medium text-ink">{task.title}</p>
                        </div>
                        <StatusBadge value={task.riskLevel} />
                      </div>
                      <p className="mt-2 text-sm leading-6 text-moss">{task.description}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{agent?.name ?? "未分配"}</span>
                        <Tag>{task.priority}</Tag>
                        <StatusBadge value={task.approvalStatus} />
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-md border border-dashed border-line bg-paper p-6 text-sm leading-6 text-moss">
                暂无拆解结果。输入目标后，执行经理会生成任务并写入 Tasks。
              </div>
            )}

            {memoriesUsed.length > 0 && (
              <div className="rounded-md border border-line bg-[#fbfcf8] p-4">
                <p className="text-sm font-semibold text-ink">本次引用的已审核记忆</p>
                <div className="mt-3 space-y-2">
                  {memoriesUsed.slice(0, 5).map((memory) => (
                    <div key={memory.id} className="rounded-md bg-paper px-3 py-2">
                      <p className="text-sm font-medium text-ink">{memory.title}</p>
                      <p className="mt-1 line-clamp-2 text-xs leading-5 text-moss">{memory.summary ?? memory.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {drafts.length > 0 && (
              <Link href="/tasks" className="inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper">
                去 Tasks 执行
                <ArrowRight size={16} />
              </Link>
            )}
          </div>
        </Panel>
      </section>
    </>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-[#fbfcf8] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-moss">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{children}</span>;
}
