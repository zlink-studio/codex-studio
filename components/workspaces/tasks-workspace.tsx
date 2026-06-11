"use client";

import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, ClipboardList, Cpu, Database, ListChecks } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import { normalizeAgent, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import { agents as fallbackAgents, projects as fallbackProjects, tasks as fallbackTasks } from "@/lib/mock-data";
import type { Agent, BoardStatus, ModelRunSummary, Project, Task } from "@/lib/types";

const boardColumns: Array<{ id: BoardStatus; title: string; helper: string }> = [
  { id: "backlog", title: "Backlog", helper: "待澄清" },
  { id: "todo", title: "Todo", helper: "可执行" },
  { id: "in_progress", title: "In Progress", helper: "Agent 执行中" },
  { id: "review", title: "Review", helper: "质量审核" },
  { id: "done", title: "Done", helper: "已完成" },
  { id: "blocked", title: "Blocked", helper: "阻塞" }
];

const nextStatus: Partial<Record<BoardStatus, BoardStatus>> = {
  backlog: "todo",
  todo: "in_progress",
  in_progress: "review",
  review: "done",
  blocked: "todo"
};

const initialForm = {
  title: "",
  description: "",
  task_type: "general",
  assigned_agent_id: "",
  project_id: "",
  priority: "medium",
  risk_level: "low",
  due_at: ""
};

type TaskLogRow = {
  id: string;
  task_id?: string;
  taskId?: string;
  agent_id?: string | null;
  agentId?: string | null;
  run_id?: string | null;
  runId?: string | null;
  type: string;
  content: string;
  metadata?: Record<string, any>;
  created_at?: string;
  createdAt?: string;
};

type AgentRunRow = {
  id: string;
  task_id?: string | null;
  taskId?: string | null;
  agent_id?: string | null;
  agentId?: string | null;
  model?: string | null;
  cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  created_at?: string;
};

type ModelRunRow = ModelRunSummary & {
  agent_run_id?: string | null;
  agentRunId?: string | null;
  created_at?: string;
};

export function TasksWorkspace() {
  const [items, setItems] = useState<Task[]>(fallbackTasks);
  const [agents, setAgents] = useState<Agent[]>(fallbackAgents);
  const [projects, setProjects] = useState<Project[]>(fallbackProjects);
  const [logs, setLogs] = useState<TaskLogRow[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRunRow[]>([]);
  const [modelRuns, setModelRuns] = useState<ModelRunRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("已加载本地示例数据");
  const [isSaving, setIsSaving] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState(fallbackTasks[0]?.id ?? "");
  const [outputAgentId, setOutputAgentId] = useState(fallbackAgents[0]?.id ?? "");
  const [outputContent, setOutputContent] = useState("");
  const [isAppendingOutput, setIsAppendingOutput] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/tasks").then((response) => readApiData<any[]>(response)),
      fetch("/api/agents").then((response) => readApiData<any[]>(response)),
      fetch("/api/projects").then((response) => readApiData<any[]>(response)),
      fetch("/api/task-logs").then((response) => readApiData<TaskLogRow[]>(response)).catch(() => []),
      fetch("/api/agent-runs").then((response) => readApiData<AgentRunRow[]>(response)).catch(() => []),
      fetch("/api/model-runs").then((response) => readApiData<ModelRunRow[]>(response)).catch(() => [])
    ])
      .then(([taskRows, agentRows, projectRows, logRows, runRows, modelRunRows]) => {
        const nextTasks = taskRows.map(normalizeTask);
        const nextAgents = agentRows.map(normalizeAgent);
        setItems(nextTasks);
        setAgents(nextAgents);
        setProjects(projectRows.map(normalizeProject));
        setLogs(logRows);
        setAgentRuns(runRows);
        setModelRuns(modelRunRows);
        setSelectedTaskId(nextTasks[0]?.id ?? "");
        setOutputAgentId(nextAgents[0]?.id ?? "");
        setMessage("已连接 Tasks API");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  const selectedTask = items.find((task) => task.id === selectedTaskId) ?? items[0];
  const selectedLogs = useMemo(
    () => logs.filter((log) => (log.task_id ?? log.taskId) === selectedTask?.id),
    [logs, selectedTask?.id]
  );
  const selectedRunIds = useMemo(
    () => new Set(selectedLogs.map((log) => log.run_id ?? log.runId).filter(Boolean)),
    [selectedLogs]
  );
  const selectedAgentRuns = useMemo(
    () => agentRuns.filter((run) => (run.task_id ?? run.taskId) === selectedTask?.id || selectedRunIds.has(run.id)),
    [agentRuns, selectedRunIds, selectedTask?.id]
  );
  const selectedModelRuns = useMemo(
    () => modelRuns.filter((run) => selectedRunIds.has(run.agent_run_id ?? run.agentRunId ?? "")),
    [modelRuns, selectedRunIds]
  );
  const memoryIds = useMemo(() => {
    const ids = selectedLogs.flatMap((log) => {
      const values = log.metadata?.memory_ids ?? log.metadata?.memoryIds ?? [];
      return Array.isArray(values) ? values : [];
    });
    return Array.from(new Set(ids));
  }, [selectedLogs]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("正在保存任务...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...form,
            due_at: form.due_at || null,
            project_id: form.project_id || null,
            assigned_agent_id: form.assigned_agent_id || null,
            board_status: "todo"
          })
        })
      );
      const nextTask = normalizeTask(data);
      setItems((current) => [nextTask, ...current]);
      setSelectedTaskId(nextTask.id);
      setForm(initialForm);
      setMessage(nextTask.approvalStatus === "pending" ? "任务已保存，并进入老板审批" : "任务已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function moveTask(task: Task, targetStatus: BoardStatus) {
    if ((targetStatus === "in_progress" || targetStatus === "review") && task.approvalStatus === "pending") {
      setMessage("该任务仍在审批中，不能进入执行或审核");
      return;
    }

    setMessage(`正在移动到 ${targetStatus}...`);
    try {
      const data = await readApiData<any>(
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: task.id,
            board_status: targetStatus,
            status: targetStatus,
            review_status: targetStatus === "review" ? "pending" : task.reviewStatus
          })
        })
      );
      const nextTask = normalizeTask(data);
      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setSelectedTaskId(task.id);
      setMessage(targetStatus === "review" ? "任务已进入 Review，等待质量审核" : "任务状态已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function approveReview(task: Task) {
    setMessage("正在通过质量审核...");
    try {
      await readApiData<any>(
        await fetch("/api/quality-reviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: task.id,
            status: "approved",
            score: 90,
            notes: "老板确认可交付"
          })
        })
      );
      setItems((current) =>
        current.map((item) =>
          item.id === task.id ? { ...item, status: "done", boardStatus: "done", reviewStatus: "approved" } : item
        )
      );
      setMessage("质量审核已通过，任务进入 Done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审核失败");
    }
  }

  async function appendOutput(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedTaskId || !outputContent.trim()) return;

    setIsAppendingOutput(true);
    setMessage("正在追加 Agent 输出...");

    try {
      const data = await readApiData<any>(
        await fetch("/api/tasks/outputs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: selectedTaskId,
            agent_id: outputAgentId,
            content: outputContent,
            status: "in_progress"
          })
        })
      );
      const nextTask = normalizeTask(data);
      const newLog: TaskLogRow = {
        id: crypto.randomUUID(),
        task_id: selectedTaskId,
        agent_id: outputAgentId,
        type: "result",
        content: outputContent,
        created_at: new Date().toISOString()
      };
      setItems((current) => current.map((task) => (task.id === nextTask.id ? nextTask : task)));
      setLogs((current) => [newLog, ...current]);
      setOutputContent("");
      setMessage("Agent 输出已写入任务记录");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "追加输出失败");
    } finally {
      setIsAppendingOutput(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="任务中心"
        description="Kanban 看板、Agent 分配、执行日志、模型调用和 Review Gate 放在同一个 MVP 页面。"
        action={<StatusPill text={message} />}
      />

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="任务创建" description="高风险任务会自动进入老板审批；执行完成后进入 Review，而不是直接 Done。">
          <form className="grid gap-4" onSubmit={submit}>
            <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="任务标题" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <textarea className="min-h-28 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="任务描述与验收标准" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
            <div className="grid gap-4 md:grid-cols-2">
              <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.task_type} onChange={(event) => setForm({ ...form, task_type: event.target.value })}>
                {["general", "content", "social", "data", "table", "simple", "code", "automation", "review"].map((type) => <option key={type} value={type}>{type}</option>)}
              </select>
              <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.assigned_agent_id} onChange={(event) => setForm({ ...form, assigned_agent_id: event.target.value })}>
                <option value="">选择 Agent</option>
                {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name} · {agent.agentRole ?? "worker"}</option>)}
              </select>
              <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.project_id} onChange={(event) => setForm({ ...form, project_id: event.target.value })}>
                <option value="">选择项目</option>
                {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                {["low", "medium", "high", "urgent"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.risk_level} onChange={(event) => setForm({ ...form, risk_level: event.target.value })}>
                {["low", "medium", "high", "critical"].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
              <input type="datetime-local" className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
            </div>
            <button className="w-fit rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存任务"}
            </button>
          </form>
        </Panel>

        <Panel title="任务详情与执行记录" description="查看 Agent 输出、模型成本/耗时，以及本任务使用过的 approved memories。">
          {selectedTask ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_0.8fr]">
                <label>
                  <span className="text-sm font-medium text-ink">选择任务</span>
                  <select className="mt-2 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" value={selectedTask.id} onChange={(event) => setSelectedTaskId(event.target.value)}>
                    {items.map((task) => <option key={task.id} value={task.id}>{task.title}</option>)}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-ink">输出 Agent</span>
                  <select className="mt-2 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" value={outputAgentId} onChange={(event) => setOutputAgentId(event.target.value)}>
                    {agents.map((agent) => <option key={agent.id} value={agent.id}>{agent.name}</option>)}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <InfoBox icon={<Cpu size={16} />} label="模型调用" value={selectedModelRuns[0] ? `${selectedModelRuns[0].provider} / ${selectedModelRuns[0].model}` : selectedAgentRuns[0]?.model ?? "暂无"} />
                <InfoBox icon={<ListChecks size={16} />} label="成本/耗时" value={selectedModelRuns[0] ? `$${(selectedModelRuns[0].estimatedCost ?? 0).toFixed(5)} · ${selectedModelRuns[0].latencyMs ?? 0}ms` : "暂无"} />
                <InfoBox icon={<Database size={16} />} label="使用记忆" value={memoryIds.length ? `${memoryIds.length} 条` : "暂无"} />
              </div>

              {memoryIds.length > 0 && (
                <div className="rounded-md border border-line bg-[#fbfcf8] p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-moss">Memory IDs</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {memoryIds.map((id) => <span key={id} className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs text-moss">{id}</span>)}
                  </div>
                </div>
              )}

              <form className="space-y-3" onSubmit={appendOutput}>
                <textarea className="min-h-24 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" placeholder="写入 Agent 本轮输出、分析结论或执行结果" value={outputContent} onChange={(event) => setOutputContent(event.target.value)} required />
                <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isAppendingOutput}>
                  {isAppendingOutput ? "写入中..." : "追加输出"}
                </button>
              </form>

              <div className="grid gap-3 md:grid-cols-2">
                <Timeline title="输出记录" empty="暂无输出记录">
                  {selectedTask.outputs.map((output) => {
                    const agent = agents.find((item) => item.id === output.agentId);
                    return <LogItem key={`${output.createdAt}-${output.content}`} title={`${agent?.name ?? output.agentId} · ${output.createdAt.slice(0, 19)}`} content={output.content} />;
                  })}
                </Timeline>
                <Timeline title="执行日志" empty="暂无日志">
                  {selectedLogs.map((log) => {
                    const agent = agents.find((item) => item.id === (log.agent_id ?? log.agentId));
                    return <LogItem key={log.id} title={`${log.type} · ${agent?.name ?? "system"} · ${(log.created_at ?? log.createdAt ?? "").slice(0, 19)}`} content={log.content} />;
                  })}
                </Timeline>
              </div>
            </div>
          ) : (
            <p className="text-sm text-moss">暂无任务。</p>
          )}
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="Kanban 任务看板" description="第一阶段先用状态按钮替代拖拽，后续可接入 dnd-kit。">
          <div className="grid gap-4 xl:grid-cols-6">
            {boardColumns.map((column) => (
              <div key={column.id} className="min-h-72 rounded-md border border-line bg-paper p-3">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{column.title}</h3>
                    <p className="mt-1 text-xs text-moss">{column.helper}</p>
                  </div>
                  <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-semibold text-moss">
                    {items.filter((task) => (task.boardStatus ?? task.status) === column.id).length}
                  </span>
                </div>
                <div className="space-y-3">
                  {items
                    .filter((task) => (task.boardStatus ?? task.status) === column.id)
                    .map((task) => (
                      <KanbanCard
                        key={task.id}
                        task={task}
                        agentName={agents.find((agent) => agent.id === task.assignedAgentId)?.name ?? "未分配"}
                        selected={task.id === selectedTask?.id}
                        onSelect={() => setSelectedTaskId(task.id)}
                        onMove={(target) => moveTask(task, target)}
                        onApproveReview={() => approveReview(task)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="任务表格" description="保留表格视图，方便扫描全部任务。">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
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
              <tbody>{items.map((task) => <TaskRow key={task.id} task={task} agents={agents} projects={projects} />)}</tbody>
            </table>
          </div>
        </Panel>
      </section>
    </>
  );
}

function KanbanCard({
  task,
  agentName,
  selected,
  onSelect,
  onMove,
  onApproveReview
}: {
  task: Task;
  agentName: string;
  selected: boolean;
  onSelect: () => void;
  onMove: (target: BoardStatus) => void;
  onApproveReview: () => void;
}) {
  const boardStatus = task.boardStatus ?? task.status;
  const next = nextStatus[boardStatus as BoardStatus];

  return (
    <article className={`rounded-md border p-3 ${selected ? "border-moss bg-[#fbfcf8]" : "border-line bg-[#fbfcf8]"}`}>
      <button className="block w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-5 text-ink">{task.title}</h4>
          <StatusBadge value={task.riskLevel} />
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-moss">{task.description}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{agentName}</span>
        <StatusBadge value={task.approvalStatus} />
        <StatusBadge value={task.reviewStatus ?? "not_required"} />
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {next && (
          <button className="inline-flex items-center gap-1 rounded-md bg-moss px-2 py-1.5 text-xs font-semibold text-paper" onClick={() => onMove(next)}>
            <ArrowRight size={13} />
            {next === "review" ? "送审" : `到 ${next}`}
          </button>
        )}
        {boardStatus === "review" && (
          <button className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1.5 text-xs font-semibold text-paper" onClick={onApproveReview}>
            <CheckCircle2 size={13} />
            Review 通过
          </button>
        )}
      </div>
    </article>
  );
}

function InfoBox({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-md border border-line bg-[#fbfcf8] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-moss">
        {icon}
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Timeline({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <div className="rounded-md border border-line bg-paper p-3">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        {title === "输出记录" ? <ClipboardList size={15} /> : <ListChecks size={15} />}
        {title}
      </div>
      <div className="space-y-2">{children.length > 0 ? children : <p className="text-sm text-moss">{empty}</p>}</div>
    </div>
  );
}

function LogItem({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-md bg-[#e8efe4] p-3 text-sm leading-6 text-moss">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1">{content}</p>
    </div>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{text}</span>;
}
