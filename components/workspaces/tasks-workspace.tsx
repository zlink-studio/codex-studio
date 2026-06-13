"use client";

import type { DragEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ClipboardList, Cpu, Database, GripVertical, ListChecks, Play, RefreshCcw, RotateCcw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import { normalizeAgent, normalizeModelRun, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import type { Agent, BoardStatus, ModelRunSummary, Project, Task } from "@/lib/types";

const boardColumns: Array<{ id: BoardStatus; title: string; helper: string }> = [
  { id: "backlog", title: "Backlog", helper: "待澄清 / 待审批" },
  { id: "todo", title: "Todo", helper: "可以执行" },
  { id: "in_progress", title: "In Progress", helper: "Agent 执行中" },
  { id: "review", title: "Review", helper: "Review Gate" },
  { id: "done", title: "Done", helper: "已完成" },
  { id: "blocked", title: "Blocked", helper: "被阻塞" }
];

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
  status?: string;
  model?: string | null;
  cost?: number;
  prompt_tokens?: number;
  completion_tokens?: number;
  error?: string | null;
  created_at?: string;
};

type ModelRunRow = ModelRunSummary & {
  agent_run_id?: string | null;
  agentRunId?: string | null;
  task_id?: string | null;
  taskId?: string | null;
};

export function TasksWorkspace() {
  const [items, setItems] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [logs, setLogs] = useState<TaskLogRow[]>([]);
  const [agentRuns, setAgentRuns] = useState<AgentRunRow[]>([]);
  const [modelRuns, setModelRuns] = useState<ModelRunRow[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("正在加载真实数据...");
  const [isSaving, setIsSaving] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [isAppendingOutput, setIsAppendingOutput] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState("");
  const [outputAgentId, setOutputAgentId] = useState("");
  const [outputContent, setOutputContent] = useState("");

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    setIsRefreshing(true);
    try {
      const [taskRows, agentRows, projectRows, logRows, runRows, modelRunRows] = await Promise.all([
        fetch("/api/tasks").then((response) => readApiData<any[]>(response)),
        fetch("/api/agents").then((response) => readApiData<any[]>(response)),
        fetch("/api/projects").then((response) => readApiData<any[]>(response)),
        fetch("/api/task-logs").then((response) => readApiData<TaskLogRow[]>(response)).catch(() => []),
        fetch("/api/agent-runs").then((response) => readApiData<AgentRunRow[]>(response)).catch(() => []),
        fetch("/api/models/runs").then((response) => readApiData<ModelRunRow[]>(response)).catch(() => [])
      ]);

      const nextTasks = taskRows.map(normalizeTask);
      const nextAgents = agentRows.map(normalizeAgent);
      setItems(nextTasks);
      setAgents(nextAgents);
      setProjects(projectRows.map(normalizeProject));
      setLogs(logRows);
      setAgentRuns(runRows);
      setModelRuns(modelRunRows.map((row) => normalizeModelRun(row) as ModelRunRow));
      setSelectedTaskId((current) => current || nextTasks[0]?.id || "");
      setOutputAgentId((current) => current || nextAgents[0]?.id || "");
      setMessage("已连接 Tasks API");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    } finally {
      setIsRefreshing(false);
    }
  }

  const selectedTask = items.find((task) => task.id === selectedTaskId) ?? items[0];
  const selectedLogs = useMemo(() => logs.filter((log) => (log.task_id ?? log.taskId) === selectedTask?.id), [logs, selectedTask?.id]);
  const selectedRunIds = useMemo(() => new Set(selectedLogs.map((log) => log.run_id ?? log.runId).filter(Boolean)), [selectedLogs]);
  const selectedAgentRuns = useMemo(
    () => agentRuns.filter((run) => (run.task_id ?? run.taskId) === selectedTask?.id || selectedRunIds.has(run.id)),
    [agentRuns, selectedRunIds, selectedTask?.id]
  );
  const selectedModelRuns = useMemo(
    () => modelRuns.filter((run) => (run.task_id ?? run.taskId) === selectedTask?.id || selectedRunIds.has(run.agent_run_id ?? run.agentRunId ?? "")),
    [modelRuns, selectedRunIds, selectedTask?.id]
  );
  const memoryIds = useMemo(() => {
    const ids = selectedLogs.flatMap((log) => {
      const values = log.metadata?.memory_ids ?? log.metadata?.memoryIds ?? [];
      return Array.isArray(values) ? values : [];
    });
    return Array.from(new Set(ids));
  }, [selectedLogs]);
  const boardMetrics = useMemo(
    () => ({
      total: items.length,
      pendingApproval: items.filter((task) => task.approvalStatus === "pending").length,
      running: items.filter((task) => (task.boardStatus ?? task.status) === "in_progress").length,
      review: items.filter((task) => (task.boardStatus ?? task.status) === "review").length,
      blocked: items.filter((task) => (task.boardStatus ?? task.status) === "blocked").length
    }),
    [items]
  );

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
            assigned_agent_id: form.assigned_agent_id || null
          })
        })
      );
      const nextTask = normalizeTask(data);
      setItems((current) => [nextTask, ...current]);
      setSelectedTaskId(nextTask.id);
      setForm(initialForm);
      setMessage(nextTask.approvalStatus === "pending" ? "高风险任务已进入老板审批" : "任务已保存，可执行");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function moveTask(task: Task, targetStatus: BoardStatus) {
    if ((targetStatus === "in_progress" || targetStatus === "review") && task.approvalStatus === "pending") {
      setMessage("该任务仍在老板审批中，不能进入执行或审核");
      return;
    }
    if ((targetStatus === "in_progress" || targetStatus === "review") && task.approvalStatus === "rejected") {
      setMessage("该任务已被拒绝，不能进入执行或审核");
      return;
    }
    if ((task.boardStatus ?? task.status) === targetStatus) return;

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
      setMessage(targetStatus === "review" ? "任务已进入 Review Gate" : "任务状态已更新");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "状态更新失败");
    }
  }

  async function retryTask(task: Task) {
    if (task.approvalStatus === "pending") {
      setMessage("该任务仍在老板审批中，不能重试");
      return;
    }
    if (task.approvalStatus === "rejected") {
      setMessage("该任务已被老板拒绝，不能重试");
      return;
    }

    setMessage("正在把任务放回 Todo...");
    try {
      const data = await readApiData<any>(
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: task.id,
            board_status: "todo",
            status: "todo",
            review_status: "not_required"
          })
        })
      );
      const nextTask = normalizeTask(data);
      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setSelectedTaskId(task.id);
      setMessage("任务已回到 Todo，可以重新执行");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重试失败");
    }
  }

  async function decideOwnerApproval(task: Task, status: "approved" | "rejected") {
    setMessage(status === "approved" ? "正在批准高风险任务..." : "正在拒绝高风险任务...");
    try {
      await readApiData<any>(
        await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: task.id,
            status,
            decision_note: status === "approved" ? "老板批准执行。" : "老板拒绝执行。"
          })
        })
      );
      const nextTask: Task = {
        ...task,
        approvalStatus: status,
        status: status === "approved" ? "todo" : "blocked",
        boardStatus: status === "approved" ? "todo" : "blocked"
      };
      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setMessage(status === "approved" ? "已批准，任务可以执行" : "已拒绝，任务进入 Blocked");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败");
    }
  }

  async function executeSelectedTask() {
    if (!selectedTask) return;
    const agentId = outputAgentId || selectedTask.assignedAgentId;
    if (!agentId) {
      setMessage("请先给任务选择一个 Agent");
      return;
    }
    if (selectedTask.approvalStatus === "pending") {
      setMessage("任务仍在老板审批中，暂不能执行");
      return;
    }
    if (selectedTask.approvalStatus === "rejected") {
      setMessage("任务已被老板拒绝，暂不能执行");
      return;
    }

    setIsExecuting(true);
    setMessage("Agent 正在执行任务...");
    setItems((current) =>
      current.map((task) => (task.id === selectedTask.id ? { ...task, status: "in_progress", boardStatus: "in_progress", reviewStatus: "not_required" } : task))
    );

    try {
      const data = await readApiData<any>(
        await fetch("/api/agent-runs/execute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ task_id: selectedTask.id, agent_id: agentId })
        })
      );
      if (data.task) {
        const nextTask = normalizeTask(data.task);
        setItems((current) => current.map((task) => (task.id === nextTask.id ? nextTask : task)));
      }
      if (data.log) setLogs((current) => [data.log, ...current]);
      if (data.agentRun) setAgentRuns((current) => [data.agentRun, ...current]);
      if (data.modelRun) setModelRuns((current) => [normalizeModelRun(data.modelRun) as ModelRunRow, ...current]);
      setMessage(data.warning ? `执行失败，任务已阻塞：${data.warning}` : "Agent 执行完成，任务已进入 Review Gate");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
      setItems((current) =>
        current.map((task) => (task.id === selectedTask.id ? { ...task, status: "blocked", boardStatus: "blocked", reviewStatus: "rejected" } : task))
      );
    } finally {
      setIsExecuting(false);
    }
  }

  async function decideReview(task: Task, status: "approved" | "rejected") {
    setMessage(status === "approved" ? "正在通过 Review..." : "正在拒绝 Review...");
    try {
      const result = await readApiData<any>(
        await fetch("/api/quality-reviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: task.id,
            status,
            score: status === "approved" ? 90 : 45,
            checklist: [
              { label: "输出符合任务目标", passed: status === "approved" },
              { label: "风险和审批状态已处理", passed: status === "approved" },
              { label: "可交付给老板或客户", passed: status === "approved" }
            ],
            notes: status === "approved" ? "老板确认可交付。" : "需要返工或重新拆解。"
          })
        })
      );
      const reworkTask = result?.rework_task ? normalizeTask(result.rework_task) : null;
      const nextBoardStatus: BoardStatus = status === "approved" ? "done" : "blocked";
      setItems((current) =>
        [
          ...(reworkTask ? [reworkTask] : []),
          ...current.map((item) =>
          item.id === task.id
            ? {
                ...item,
                status: nextBoardStatus,
                boardStatus: nextBoardStatus,
                reviewStatus: status
              }
            : item
          )
        ]
      );
      setMessage(status === "approved" ? "Review 已通过，任务进入 Done" : "Review 已拒绝，已生成返工任务");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Review 更新失败");
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

  function onDrop(columnId: BoardStatus, event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    const taskId = draggedTaskId ?? event.dataTransfer.getData("text/task-id");
    const task = items.find((item) => item.id === taskId);
    setDraggedTaskId(null);
    if (task) void moveTask(task, columnId);
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="任务中心"
        description="管理任务创建、老板审批、Agent 执行、Review Gate 和交付状态。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => loadData()}
              className="inline-flex items-center gap-2 rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm font-semibold text-moss disabled:opacity-60"
              disabled={isRefreshing}
            >
              <RefreshCcw size={15} />
              {isRefreshing ? "刷新中" : "刷新"}
            </button>
            <StatusPill text={message} />
          </div>
        }
      />

      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MetricBox label="全部任务" value={boardMetrics.total} />
        <MetricBox label="待老板审批" value={boardMetrics.pendingApproval} tone={boardMetrics.pendingApproval ? "warn" : "normal"} />
        <MetricBox label="执行中" value={boardMetrics.running} />
        <MetricBox label="待 Review" value={boardMetrics.review} tone={boardMetrics.review ? "warn" : "normal"} />
        <MetricBox label="Blocked" value={boardMetrics.blocked} tone={boardMetrics.blocked ? "danger" : "normal"} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title="任务创建" description="高风险任务会先进入老板审批；审批通过后才可执行。">
          <form className="grid gap-4" onSubmit={submit}>
            <input className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="任务标题" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
            <textarea className="min-h-28 rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" placeholder="任务描述与验收标准" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} required />
            <div className="grid gap-4 md:grid-cols-2">
              <Select value={form.task_type} onChange={(value) => setForm({ ...form, task_type: value })} options={["general", "content", "social", "data", "table", "simple", "code", "automation", "review", "contract", "long_document"]} />
              <Select value={form.assigned_agent_id} onChange={(value) => setForm({ ...form, assigned_agent_id: value })} options={["", ...agents.map((agent) => agent.id)]} labels={{ "": "选择 Agent", ...Object.fromEntries(agents.map((agent) => [agent.id, `${agent.name} / ${agent.agentRole ?? "worker"}`])) }} />
              <Select value={form.project_id} onChange={(value) => setForm({ ...form, project_id: value })} options={["", ...projects.map((project) => project.id)]} labels={{ "": "选择项目", ...Object.fromEntries(projects.map((project) => [project.id, project.name])) }} />
              <Select value={form.priority} onChange={(value) => setForm({ ...form, priority: value })} options={["low", "medium", "high", "urgent"]} />
              <Select value={form.risk_level} onChange={(value) => setForm({ ...form, risk_level: value })} options={["low", "medium", "high", "critical"]} />
              <input type="datetime-local" className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
            </div>
            <button className="w-fit rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存任务"}
            </button>
          </form>
        </Panel>

        <Panel title="任务详情与执行" description="选择任务后，可审批高风险任务、执行 Agent、追加输出，并完成 Review Gate。">
          {selectedTask ? (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-[1fr_0.8fr]">
                <label>
                  <span className="text-sm font-medium text-ink">选择任务</span>
                  <select className="mt-2 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" value={selectedTask.id} onChange={(event) => setSelectedTaskId(event.target.value)}>
                    {items.map((task) => (
                      <option key={task.id} value={task.id}>{task.title}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="text-sm font-medium text-ink">执行 Agent</span>
                  <select className="mt-2 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" value={outputAgentId} onChange={(event) => setOutputAgentId(event.target.value)}>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>{agent.name} / {agent.agentRole ?? "worker"}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                {selectedTask.approvalStatus === "pending" && (
                  <>
                    <button onClick={() => decideOwnerApproval(selectedTask, "approved")} className="inline-flex items-center gap-2 rounded-md bg-moss px-3 py-2 text-sm font-semibold text-paper">
                      <CheckCircle2 size={16} />
                      批准执行
                    </button>
                    <button onClick={() => decideOwnerApproval(selectedTask, "rejected")} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-moss">
                      <XCircle size={16} />
                      拒绝任务
                    </button>
                  </>
                )}
                <button onClick={executeSelectedTask} disabled={isExecuting || selectedTask.approvalStatus === "pending" || selectedTask.approvalStatus === "rejected"} className="inline-flex items-center gap-2 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-60">
                  <Play size={16} />
                  {isExecuting ? "执行中..." : "执行 Agent"}
                </button>
                {selectedTask.boardStatus === "blocked" && selectedTask.approvalStatus !== "rejected" && (
                  <button onClick={() => retryTask(selectedTask)} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-moss">
                    <RotateCcw size={16} />
                    放回 Todo
                  </button>
                )}
                {selectedTask.boardStatus === "review" && (
                  <>
                    <button onClick={() => decideReview(selectedTask, "approved")} className="inline-flex items-center gap-2 rounded-md bg-moss px-3 py-2 text-sm font-semibold text-paper">
                      <CheckCircle2 size={16} />
                      Review 通过
                    </button>
                    <button onClick={() => decideReview(selectedTask, "rejected")} className="inline-flex items-center gap-2 rounded-md border border-line px-3 py-2 text-sm font-semibold text-moss">
                      <XCircle size={16} />
                      Review 拒绝
                    </button>
                  </>
                )}
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                <InfoBox icon={<Cpu size={16} />} label="模型调用" value={selectedModelRuns[0] ? `${selectedModelRuns[0].provider} / ${selectedModelRuns[0].model}` : selectedAgentRuns[0]?.model ?? "暂无"} />
                <InfoBox icon={<ListChecks size={16} />} label="成本/耗时" value={selectedModelRuns[0] ? `$${(selectedModelRuns[0].estimatedCost ?? 0).toFixed(5)} / ${selectedModelRuns[0].latencyMs ?? 0}ms` : "暂无"} />
                <InfoBox icon={<Database size={16} />} label="使用记忆" value={memoryIds.length ? `${memoryIds.length} 条` : "暂无"} />
              </div>

              {selectedTask.approvalStatus === "pending" && (
                <div className="flex items-start gap-2 rounded-md border border-line bg-amber/10 p-3 text-sm leading-6 text-[#7a4814]">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  这是高风险任务，必须先由老板批准，Agent 才能执行。
                </div>
              )}

              <form className="space-y-3" onSubmit={appendOutput}>
                <textarea className="min-h-24 w-full rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm outline-none focus:border-moss" placeholder="手动追加 Agent 输出、分析结论或执行结果" value={outputContent} onChange={(event) => setOutputContent(event.target.value)} required />
                <button className="rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper disabled:opacity-60" disabled={isAppendingOutput}>
                  {isAppendingOutput ? "写入中..." : "追加输出"}
                </button>
              </form>

              <div className="grid gap-3 md:grid-cols-2">
                <Timeline title="输出记录" empty="暂无输出记录">
                  {selectedTask.outputs.map((output) => {
                    const agent = agents.find((item) => item.id === output.agentId);
                    return <LogItem key={`${output.createdAt}-${output.content}`} title={`${agent?.name ?? output.agentId} / ${output.createdAt.slice(0, 19)}`} content={output.content} />;
                  })}
                </Timeline>
                <Timeline title="执行日志" empty="暂无日志">
                  {selectedLogs.map((log) => {
                    const agent = agents.find((item) => item.id === (log.agent_id ?? log.agentId));
                    return <LogItem key={log.id} title={`${log.type} / ${agent?.name ?? "system"} / ${(log.created_at ?? log.createdAt ?? "").slice(0, 19)}`} content={log.content} />;
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
        <Panel title="Kanban 任务看板" description="拖拽任务卡流转状态；审批中的高风险任务会被拦截。">
          <div className="grid gap-4 xl:grid-cols-6">
            {boardColumns.map((column) => (
              <div
                key={column.id}
                className="min-h-72 rounded-md border border-line bg-paper p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(column.id, event)}
              >
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
                        onDragStart={(event) => {
                          setDraggedTaskId(task.id);
                          event.dataTransfer.setData("text/task-id", task.id);
                        }}
                        onApprove={() => decideOwnerApproval(task, "approved")}
                        onReject={() => decideOwnerApproval(task, "rejected")}
                        onReviewApprove={() => decideReview(task, "approved")}
                        onReviewReject={() => decideReview(task, "rejected")}
                        onRetry={() => retryTask(task)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <Panel title="任务表格" description="表格视图方便扫描全部任务。">
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
  onDragStart,
  onApprove,
  onReject,
  onReviewApprove,
  onReviewReject,
  onRetry
}: {
  task: Task;
  agentName: string;
  selected: boolean;
  onSelect: () => void;
  onDragStart: (event: DragEvent<HTMLElement>) => void;
  onApprove: () => void;
  onReject: () => void;
  onReviewApprove: () => void;
  onReviewReject: () => void;
  onRetry: () => void;
}) {
  return (
    <article
      draggable
      onDragStart={onDragStart}
      className={`cursor-grab rounded-md border p-3 active:cursor-grabbing ${selected ? "border-moss bg-[#fbfcf8]" : "border-line bg-[#fbfcf8]"}`}
    >
      <button className="block w-full text-left" onClick={onSelect}>
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold leading-5 text-ink">{task.title}</h4>
          <GripVertical size={16} className="shrink-0 text-moss" />
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-moss">{task.description}</p>
      </button>
      <div className="mt-3 flex flex-wrap gap-2">
        <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">{agentName}</span>
        <StatusBadge value={task.riskLevel} />
        <StatusBadge value={task.approvalStatus} />
        <StatusBadge value={task.reviewStatus ?? "not_required"} />
      </div>
      {task.approvalStatus === "pending" && (
        <div className="mt-3 flex gap-2">
          <button className="rounded-md bg-moss px-2 py-1.5 text-xs font-semibold text-paper" onClick={onApprove}>批准</button>
          <button className="rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-moss" onClick={onReject}>拒绝</button>
        </div>
      )}
      {task.boardStatus === "review" && (
        <div className="mt-3 flex gap-2">
          <button className="rounded-md bg-ink px-2 py-1.5 text-xs font-semibold text-paper" onClick={onReviewApprove}>Review 通过</button>
          <button className="rounded-md border border-line px-2 py-1.5 text-xs font-semibold text-moss" onClick={onReviewReject}>拒绝</button>
        </div>
      )}
      {task.boardStatus === "blocked" && task.approvalStatus !== "rejected" && (
        <div className="mt-3 flex gap-2">
          <button className="inline-flex items-center gap-1 rounded-md bg-ink px-2 py-1.5 text-xs font-semibold text-paper" onClick={onRetry}>
            <RotateCcw size={13} />
            放回 Todo
          </button>
        </div>
      )}
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

function MetricBox({ label, value, tone = "normal" }: { label: string; value: number; tone?: "normal" | "warn" | "danger" }) {
  const toneClass =
    tone === "danger"
      ? "border-[#d89b8c] bg-[#fff7f4] text-[#8a3427]"
      : tone === "warn"
        ? "border-[#d8b46a] bg-[#fffaf0] text-[#7a4814]"
        : "border-line bg-[#fbfcf8] text-moss";

  return (
    <div className={`rounded-md border p-3 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
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
      <p className="mt-1 whitespace-pre-wrap">{content}</p>
    </div>
  );
}

function Select({ value, onChange, options, labels = {} }: { value: string; onChange: (value: string) => void; options: string[]; labels?: Record<string, string> }) {
  return (
    <select className="rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => (
        <option key={option || "blank"} value={option}>
          {labels[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{text}</span>;
}
