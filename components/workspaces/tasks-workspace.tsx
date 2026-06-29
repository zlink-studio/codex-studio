"use client";

import type { DragEvent, FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, ClipboardList, Play, RefreshCcw, RotateCcw, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { StatusBadge } from "@/components/status-badge";
import { TaskRow } from "@/components/task-row";
import {
  normalizeAgent,
  normalizeModelRun,
  normalizeProject,
  normalizeSkillRun,
  normalizeTask,
  readApiData
} from "@/lib/client-normalizers";
import type { Agent, BoardStatus, ModelRunSummary, Project, SkillRun, Task } from "@/lib/types";

const boardColumns: Array<{ id: BoardStatus; title: string; helper: string }> = [
  { id: "backlog", title: "待整理", helper: "刚进入系统，等待明确拆解和指派。" },
  { id: "todo", title: "待执行", helper: "任务已清楚，准备交给员工开工。" },
  { id: "in_progress", title: "执行中", helper: "员工正在推进，过程中可持续补充产出。" },
  { id: "review", title: "待复核", helper: "需要老板或复核角色确认质量与风险。" },
  { id: "done", title: "已完成", helper: "结果已经确认，可归档或进入下一环节。" },
  { id: "blocked", title: "已阻塞", helper: "存在审批、依赖或风险问题，需要处理。" }
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

const taskTypeLabels: Record<string, string> = {
  general: "通用任务",
  code: "代码开发",
  content: "内容生产",
  automation: "自动化",
  review: "复核检查",
  data: "数据处理"
};

const priorityLabels: Record<string, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急"
};

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "关键风险"
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
  const [skillRuns, setSkillRuns] = useState<SkillRun[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("正在加载任务数据...");
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
      const [taskRows, agentRows, projectRows, logRows, runRows, modelRunRows, skillRunRows] =
        await Promise.all([
          fetch("/api/tasks").then((response) => readApiData<any[]>(response)),
          fetch("/api/agents").then((response) => readApiData<any[]>(response)),
          fetch("/api/projects").then((response) => readApiData<any[]>(response)),
          fetch("/api/task-logs").then((response) => readApiData<TaskLogRow[]>(response)).catch(() => []),
          fetch("/api/agent-runs").then((response) => readApiData<AgentRunRow[]>(response)).catch(() => []),
          fetch("/api/models/runs").then((response) => readApiData<ModelRunRow[]>(response)).catch(() => []),
          fetch("/api/skill-runs").then((response) => readApiData<any[]>(response)).catch(() => [])
        ]);

      const nextTasks = taskRows.map(normalizeTask);
      const nextAgents = agentRows.map(normalizeAgent);

      setItems(nextTasks);
      setAgents(nextAgents);
      setProjects(projectRows.map(normalizeProject));
      setLogs(logRows);
      setAgentRuns(runRows);
      setModelRuns(modelRunRows.map((row) => normalizeModelRun(row) as ModelRunRow));
      setSkillRuns(skillRunRows.map(normalizeSkillRun));
      setSelectedTaskId((current) => current || nextTasks[0]?.id || "");
      setOutputAgentId((current) => current || nextAgents[0]?.id || "");
      setMessage(`已同步 ${nextTasks.length} 个任务、${logRows.length} 条日志。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载任务失败");
    } finally {
      setIsRefreshing(false);
    }
  }

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
    () =>
      agentRuns.filter(
        (run) => (run.task_id ?? run.taskId) === selectedTask?.id || selectedRunIds.has(run.id)
      ),
    [agentRuns, selectedRunIds, selectedTask?.id]
  );
  const selectedModelRuns = useMemo(
    () =>
      modelRuns.filter(
        (run) =>
          (run.task_id ?? run.taskId) === selectedTask?.id ||
          selectedRunIds.has(run.agent_run_id ?? run.agentRunId ?? "")
      ),
    [modelRuns, selectedRunIds, selectedTask?.id]
  );
  const selectedSkillRuns = useMemo(
    () => skillRuns.filter((run) => run.taskId === selectedTask?.id),
    [skillRuns, selectedTask?.id]
  );

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
    setMessage("正在创建任务...");

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
      setMessage(
        nextTask.approvalStatus === "pending"
          ? "任务已创建，因风险级别较高，正在等待审批。"
          : "任务已创建，可以直接安排执行。"
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建任务失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function patchTask(payload: Record<string, unknown>) {
    return readApiData<any>(
      await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      })
    );
  }

  async function moveTask(task: Task, targetStatus: BoardStatus) {
    if ((targetStatus === "in_progress" || targetStatus === "review") && task.approvalStatus === "pending") {
      setMessage("这条任务还在待审批，暂时不能推进到执行或复核。");
      return;
    }
    if ((targetStatus === "in_progress" || targetStatus === "review") && task.approvalStatus === "rejected") {
      setMessage("这条任务已被拒绝，需要先调整任务内容。");
      return;
    }
    if ((task.boardStatus ?? task.status) === targetStatus) return;

    try {
      const data = await patchTask({
        id: task.id,
        board_status: targetStatus,
        status: targetStatus,
        review_status: targetStatus === "review" ? "pending" : task.reviewStatus
      });
      const nextTask = normalizeTask(data);
      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setSelectedTaskId(task.id);
      setMessage(targetStatus === "review" ? "任务已送入复核。" : "任务状态已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新状态失败");
    }
  }

  async function retryTask(task: Task) {
    try {
      const data = await patchTask({
        id: task.id,
        board_status: "todo",
        status: "todo",
        review_status: "not_required"
      });
      const nextTask = normalizeTask(data);
      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setSelectedTaskId(task.id);
      setMessage("任务已退回待执行。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "重试失败");
    }
  }

  async function decideOwnerApproval(task: Task, status: "approved" | "rejected") {
    try {
      await readApiData<any>(
        await fetch("/api/approvals", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_id: task.id,
            status,
            decision_note:
              status === "approved" ? "老板已批准执行。" : "老板已拒绝，需要重新评估。"
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
      setSelectedTaskId(task.id);
      setMessage(status === "approved" ? "审批已通过，任务可以执行。" : "审批已拒绝，任务已阻塞。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "审批失败");
    }
  }

  async function executeSelectedTask() {
    if (!selectedTask) return;
    const agentId = outputAgentId || selectedTask.assignedAgentId;
    if (!agentId) {
      setMessage("请先给任务指定一个员工。");
      return;
    }

    setIsExecuting(true);
    setMessage("员工正在执行任务...");
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
      if (data.modelRun) {
        setModelRuns((current) => [normalizeModelRun(data.modelRun) as ModelRunRow, ...current]);
      }
      if (Array.isArray(data.skillRuns)) {
        setSkillRuns((current) => [...data.skillRuns.map((row: any) => normalizeSkillRun(row)), ...current]);
      }

      setMessage(data.warning ? `任务执行完成，但有提醒：${data.warning}` : "任务执行完成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "执行失败");
    } finally {
      setIsExecuting(false);
    }
  }

  async function decideReview(task: Task, status: "approved" | "rejected") {
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
              { label: "结果是否完整", passed: status === "approved" },
              { label: "信息是否准确", passed: status === "approved" },
              { label: "状态是否可交付", passed: status === "approved" }
            ],
            notes: status === "approved" ? "复核通过，可以结项。" : "需要继续返工。"
          })
        })
      );

      const reworkTask = result?.rework_task ? normalizeTask(result.rework_task) : null;
      const nextTask: Task =
        reworkTask ??
        ({
          ...task,
          status: status === "approved" ? "done" : "blocked",
          boardStatus: status === "approved" ? "done" : "blocked",
          reviewStatus: status
        } as Task);

      setItems((current) => current.map((item) => (item.id === task.id ? nextTask : item)));
      setSelectedTaskId(task.id);
      setMessage(status === "approved" ? "复核已通过。" : "复核驳回，任务需要返工。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复核失败");
    }
  }

  async function appendOutput() {
    if (!selectedTask || !outputAgentId || !outputContent.trim()) {
      setMessage("请选择员工并填写补充输出内容。");
      return;
    }

    setIsAppendingOutput(true);
    try {
      const result = await patchTask({
        id: selectedTask.id,
        append_output: {
          agentId: outputAgentId,
          content: outputContent.trim()
        }
      });
      const nextTask = normalizeTask(result);
      setItems((current) => current.map((item) => (item.id === nextTask.id ? nextTask : item)));
      setOutputContent("");
      setMessage("已追加任务输出。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "追加输出失败");
    } finally {
      setIsAppendingOutput(false);
    }
  }

  function onDrop(targetStatus: BoardStatus, event: DragEvent<HTMLElement>) {
    event.preventDefault();
    const taskId = event.dataTransfer.getData("text/task-id") || draggedTaskId;
    setDraggedTaskId(null);
    if (!taskId) return;
    const task = items.find((item) => item.id === taskId);
    if (!task) return;
    void moveTask(task, targetStatus);
  }

  return (
    <>
      <PageHeader
        eyebrow="Tasks"
        title="任务中心"
        description="在这里创建任务、审批高风险事项、查看员工执行日志，并把任务一路推进到交付。"
        action={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void loadData()}
              className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/60 px-4 py-2 text-sm font-semibold text-moss"
            >
              <RefreshCcw size={15} />
              刷新
            </button>
            <StatusPill text={isRefreshing ? "正在同步任务数据..." : message} />
          </div>
        }
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricBox label="全部任务" value={boardMetrics.total} />
        <MetricBox label="待审批" value={boardMetrics.pendingApproval} tone="warn" />
        <MetricBox label="执行中" value={boardMetrics.running} />
        <MetricBox label="待复核" value={boardMetrics.review} tone="warn" />
        <MetricBox label="已阻塞" value={boardMetrics.blocked} tone="danger" />
      </section>

      <section className="space-y-6">
        <CollapsiblePanel
          title="手动创建任务"
          description="日常一般由 AI 自动拆任务；需要手动补一条时再展开。"
          icon={<ClipboardList size={16} />}
          defaultOpen={false}
        >
          <form className="space-y-4" onSubmit={submit}>
            <Field label="任务标题">
              <input
                className="w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                value={form.title}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="例如：完成外贸建站首页初稿"
                required
              />
            </Field>

            <Field label="任务说明">
              <textarea
                className="min-h-[110px] w-full rounded-[24px] border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                value={form.description}
                onChange={(event) =>
                  setForm((current) => ({ ...current, description: event.target.value }))
                }
                placeholder="写清楚目标、验收标准、边界和注意事项。"
                required
              />
            </Field>

            <div className="grid gap-4 md:grid-cols-2">
              <Field label="任务类型">
                <Select
                  value={form.task_type}
                  onChange={(value) => setForm((current) => ({ ...current, task_type: value }))}
                  options={["general", "code", "content", "automation", "review", "data"]}
                  labels={taskTypeLabels}
                />
              </Field>
              <Field label="优先级">
                <Select
                  value={form.priority}
                  onChange={(value) => setForm((current) => ({ ...current, priority: value }))}
                  options={["low", "medium", "high", "urgent"]}
                  labels={priorityLabels}
                />
              </Field>
              <Field label="风险等级">
                <Select
                  value={form.risk_level}
                  onChange={(value) => setForm((current) => ({ ...current, risk_level: value }))}
                  options={["low", "medium", "high", "critical"]}
                  labels={riskLabels}
                />
              </Field>
              <Field label="负责人">
                <select
                  className="w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                  value={form.assigned_agent_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, assigned_agent_id: event.target.value }))
                  }
                >
                  <option value="">暂不指定</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name} / {agent.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="所属项目">
                <select
                  className="w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                  value={form.project_id}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, project_id: event.target.value }))
                  }
                >
                  <option value="">不挂项目</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="截止时间">
                <input
                  type="datetime-local"
                  className="w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                  value={form.due_at}
                  onChange={(event) => setForm((current) => ({ ...current, due_at: event.target.value }))}
                />
              </Field>
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {isSaving ? "创建中..." : "保存任务"}
            </button>
          </form>
        </CollapsiblePanel>

        {selectedTask ? (
          <Panel
            title="任务详情"
            description="选中的任务：可以直接审批、执行、补充产出和查看日志。"
          >
            <div className="space-y-6">
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-line/70 bg-paper/55 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-ink">{selectedTask.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-moss">{selectedTask.description}</p>
                      </div>
                      <Bot size={18} className="shrink-0 text-moss" />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <StatusBadge value={selectedTask.riskLevel} />
                      <StatusBadge value={selectedTask.approvalStatus} />
                      <StatusBadge value={selectedTask.reviewStatus ?? "not_required"} />
                      <StatusBadge value={selectedTask.boardStatus ?? selectedTask.status} />
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-3">
                      <InfoBox
                        label="负责人"
                        value={
                          agents.find((agent) => agent.id === selectedTask.assignedAgentId)?.name ??
                          "未分配"
                        }
                      />
                      <InfoBox
                        label="所属项目"
                        value={
                          projects.find((project) => project.id === selectedTask.projectId)?.name ??
                          "无项目"
                        }
                      />
                      <InfoBox
                        label="截止时间"
                        value={
                          selectedTask.dueAt
                            ? selectedTask.dueAt.replace("T", " ").slice(0, 16)
                            : "未填写"
                        }
                      />
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-line/70 bg-paper/55 p-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        className="min-w-[220px] rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                        value={outputAgentId}
                        onChange={(event) => setOutputAgentId(event.target.value)}
                      >
                        {agents.map((agent) => (
                          <option key={agent.id} value={agent.id}>
                            {agent.name} / {agent.title}
                          </option>
                        ))}
                      </select>

                      <ActionButton
                        onClick={() => void executeSelectedTask()}
                        icon={<Play size={15} />}
                        primary
                        disabled={isExecuting}
                      >
                        {isExecuting ? "执行中..." : "执行任务"}
                      </ActionButton>

                      {selectedTask.approvalStatus === "pending" && (
                        <>
                          <ActionButton
                            onClick={() => void decideOwnerApproval(selectedTask, "approved")}
                            icon={<CheckCircle2 size={15} />}
                            primary
                          >
                            批准执行
                          </ActionButton>
                          <ActionButton
                            onClick={() => void decideOwnerApproval(selectedTask, "rejected")}
                            icon={<XCircle size={15} />}
                          >
                            拒绝
                          </ActionButton>
                        </>
                      )}

                      {(selectedTask.boardStatus ?? selectedTask.status) === "review" && (
                        <>
                          <ActionButton
                            onClick={() => void decideReview(selectedTask, "approved")}
                            icon={<CheckCircle2 size={15} />}
                            dark
                          >
                            复核通过
                          </ActionButton>
                          <ActionButton
                            onClick={() => void decideReview(selectedTask, "rejected")}
                            icon={<XCircle size={15} />}
                          >
                            打回返工
                          </ActionButton>
                        </>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
                      <textarea
                        className="min-h-[110px] rounded-[24px] border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
                        placeholder="手动补充员工输出、老板备注或执行结果。"
                        value={outputContent}
                        onChange={(event) => setOutputContent(event.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => void appendOutput()}
                        disabled={isAppendingOutput}
                        className="rounded-full border border-line/70 px-4 py-2 text-sm font-semibold text-moss disabled:opacity-60"
                      >
                        {isAppendingOutput ? "写入中..." : "追加输出"}
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-2">
                    <Timeline title="任务输出" empty="这条任务还没有产出。">
                      {selectedTask.outputs.map((output, index) => {
                        const agent = agents.find((item) => item.id === output.agentId);
                        return (
                          <LogItem
                            key={`${output.createdAt}-${index}`}
                            title={`${agent?.name ?? output.agentId} / ${output.createdAt.slice(0, 19)}`}
                            content={output.content}
                          />
                        );
                      })}
                    </Timeline>
                    <Timeline title="执行日志" empty="暂时还没有日志。">
                      {selectedLogs.map((log) => {
                        const agent = agents.find((item) => item.id === (log.agent_id ?? log.agentId));
                        return (
                          <LogItem
                            key={log.id}
                            title={`${log.type} / ${agent?.name ?? "system"} / ${(log.created_at ?? log.createdAt ?? "").slice(0, 19)}`}
                            content={log.content}
                          />
                        );
                      })}
                    </Timeline>
                  </div>
                </div>

                <div className="space-y-4">
                  <CollapsiblePanel
                    title="运行记录（模型 / 技能 / Agent）"
                    description="这条任务背后的模型调用、技能执行和成本明细。"
                    defaultOpen={false}
                    className="!rounded-[20px]"
                  >
                    <div className="space-y-4">
                      <Timeline title="Agent Runs" empty="还没有 agent run 记录。">
                        {selectedAgentRuns.map((run) => (
                          <LogItem
                            key={run.id}
                            title={`${run.model ?? "local-executor"} / ${run.status ?? "unknown"} / ${(run.created_at ?? "").slice(0, 19)}`}
                            content={`run_id: ${run.id}\ncost: ${run.cost ?? 0}`}
                          />
                        ))}
                      </Timeline>
                      <Timeline title="Model Runs" empty="还没有 model run 记录。">
                        {selectedModelRuns.map((run) => (
                          <LogItem
                            key={run.id ?? `${run.provider}-${run.model}-${run.createdAt ?? ""}`}
                            title={`${run.provider} / ${run.model} / ${(run.createdAt ?? "").slice(0, 19)}`}
                            content={`status: ${run.status ?? "unknown"}\nlatency: ${run.latencyMs ?? 0} ms\nestimated cost: ${run.estimatedCost ?? 0}`}
                          />
                        ))}
                      </Timeline>
                      <Timeline title="技能执行" empty="这条任务还没有技能执行记录。">
                        {selectedSkillRuns.map((run) => (
                          <LogItem
                            key={run.id}
                            title={`${run.skillId} / ${run.status} / ${run.createdAt.slice(0, 19)}`}
                            content={run.output ? JSON.stringify(run.output, null, 2) : run.error ?? "无额外输出"}
                          />
                        ))}
                      </Timeline>
                    </div>
                  </CollapsiblePanel>
                </div>
              </div>
            </div>
          </Panel>
        ) : null}
      </section>

      <section className="mt-6">
        <Panel
          title="任务看板"
          description="拖动卡片可在阶段间流转；点击卡片在上方查看详情。高风险未审批的任务会被拦住。"
        >
          <div className="grid gap-4 xl:grid-cols-6">
            {boardColumns.map((column) => (
              <div
                key={column.id}
                className="min-h-72 rounded-[24px] border border-line/70 bg-paper/55 p-3"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => onDrop(column.id, event)}
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold text-ink">{column.title}</h3>
                    <p className="mt-1 text-xs text-moss">{column.helper}</p>
                  </div>
                  <span className="rounded-full bg-[#e8efe4] px-2.5 py-1 text-xs font-semibold text-moss">
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
                        agentName={
                          agents.find((agent) => agent.id === task.assignedAgentId)?.name ?? "未分配"
                        }
                        selected={task.id === selectedTask?.id}
                        onSelect={() => setSelectedTaskId(task.id)}
                        onDragStart={(event) => {
                          setDraggedTaskId(task.id);
                          event.dataTransfer.setData("text/task-id", task.id);
                        }}
                        onApprove={() => void decideOwnerApproval(task, "approved")}
                        onReject={() => void decideOwnerApproval(task, "rejected")}
                        onReviewApprove={() => void decideReview(task, "approved")}
                        onReviewReject={() => void decideReview(task, "rejected")}
                        onRetry={() => void retryTask(task)}
                      />
                    ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="mt-6">
        <CollapsiblePanel
          title="任务总表"
          description="从全局角度扫一遍任务分布、审批状态、所属项目和负责人。"
          defaultOpen={false}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left">
              <thead>
                <tr className="border-b border-line/70 text-xs uppercase tracking-wide text-moss">
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
        </CollapsiblePanel>
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
      className={`cursor-grab rounded-[20px] border p-3 active:cursor-grabbing ${
        selected ? "border-moss bg-[#fbfcf8]" : "border-line/70 bg-[#fbfcf8]"
      }`}
    >
      <button className="block w-full text-left" onClick={onSelect}>
        <h4 className="text-sm font-semibold leading-5 text-ink">{task.title}</h4>
        <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-moss">{task.description}</p>
      </button>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-[#e8efe4] px-2 py-0.5 text-xs font-medium text-moss">
          <Bot size={12} />
          {agentName}
        </span>
        <StatusBadge value={task.riskLevel} />
        {task.approvalStatus === "pending" ? <StatusBadge value={task.approvalStatus} /> : null}
        {task.reviewStatus && task.reviewStatus !== "not_required" ? <StatusBadge value={task.reviewStatus} /> : null}
      </div>

      {task.approvalStatus === "pending" && (
        <div className="mt-3 flex gap-2">
          <button className="rounded-full bg-moss px-3 py-1.5 text-xs font-semibold text-paper" onClick={onApprove}>
            批准
          </button>
          <button className="rounded-full border border-line/70 px-3 py-1.5 text-xs font-semibold text-moss" onClick={onReject}>
            拒绝
          </button>
        </div>
      )}

      {(task.boardStatus ?? task.status) === "review" && (
        <div className="mt-3 flex gap-2">
          <button className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper" onClick={onReviewApprove}>
            通过
          </button>
          <button className="rounded-full border border-line/70 px-3 py-1.5 text-xs font-semibold text-moss" onClick={onReviewReject}>
            打回
          </button>
        </div>
      )}

      {(task.boardStatus ?? task.status) === "blocked" && task.approvalStatus !== "rejected" && (
        <div className="mt-3 flex gap-2">
          <button
            className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper"
            onClick={onRetry}
          >
            <RotateCcw size={13} />
            退回待执行
          </button>
        </div>
      )}
    </article>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function MetricBox({
  label,
  value,
  tone = "normal"
}: {
  label: string;
  value: number;
  tone?: "normal" | "warn" | "danger";
}) {
  const toneClass =
    tone === "danger"
      ? "border-[#d89b8c] bg-[#fff7f4] text-[#8a3427]"
      : tone === "warn"
        ? "border-[#d8b46a] bg-[#fffaf0] text-[#7a4814]"
        : "border-line/70 bg-[#fbfcf8] text-moss";

  return (
    <div className={`rounded-[24px] border p-4 ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[20px] border border-line/70 bg-[#fbfcf8] p-3">
      <div className="text-xs font-semibold uppercase tracking-wide text-moss">{label}</div>
      <p className="mt-2 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function Timeline({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: ReactNode[] | ReactNode;
}) {
  const childArray = Array.isArray(children) ? children : children ? [children] : [];

  return (
    <div className="rounded-[24px] border border-line/70 bg-paper/55 p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-ink">
        <ClipboardList size={15} />
        {title}
      </div>
      <div className="space-y-2">
        {childArray.length > 0 ? childArray : <p className="text-sm text-moss">{empty}</p>}
      </div>
    </div>
  );
}

function LogItem({ title, content }: { title: string; content: string }) {
  return (
    <div className="rounded-[20px] bg-[#e8efe4] p-3 text-sm leading-6 text-moss">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 whitespace-pre-wrap break-words">{content}</p>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  labels
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      className="w-full rounded-2xl border border-line/70 bg-paper/70 px-4 py-3 text-sm outline-none focus:border-moss"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

function StatusPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">
      {text}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  icon,
  primary,
  dark,
  disabled
}: {
  children: ReactNode;
  onClick: () => void;
  icon?: ReactNode;
  primary?: boolean;
  dark?: boolean;
  disabled?: boolean;
}) {
  const className = dark
    ? "bg-ink text-paper"
    : primary
      ? "bg-moss text-paper"
      : "border border-line/70 text-moss";

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold disabled:opacity-60 ${className}`}
    >
      {icon}
      {children}
    </button>
  );
}
