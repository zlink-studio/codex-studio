import { useState, type ReactNode } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { ArrowUpRight, CalendarDays, Check, ChevronDown, CircleCheck, CircleDollarSign, FileText, Inbox, Plus, Search, Sparkles, Workflow, type LucideIcon } from "lucide-react";
import type { Agent, DashboardSummary, Issue } from "@paperclipai/shared";
import { Link } from "@/lib/router";
import { queryKeys } from "@/lib/queryKeys";
import { formatCents } from "@/lib/utils";
import { artifactsApi } from "@/api/artifacts";
import { issuesApi } from "@/api/issues";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { StatusIcon } from "@/components/StatusIcon";
import { AgentIdentity } from "@/components/AgentIdentity";

const STATUS_LABELS: Record<string, string> = {
  backlog: "待安排", todo: "待执行", in_progress: "进行中", in_review: "待审阅",
  blocked: "受阻", done: "已完成", cancelled: "已取消",
};
const FILTERS = [
  { id: "all", label: "最近更新" }, { id: "active", label: "进行中" }, { id: "review", label: "待审阅" },
] as const;

function updatedDate(value: string | Date) {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric", timeZone: "Asia/Shanghai" }).format(new Date(value));
}

function MetricCard({ to, label, value, unit, detail, icon: Icon, tone }: {
  to: string; label: string; value: ReactNode; unit?: string; detail: string; icon: LucideIcon; tone: string;
}) {
  return <Link to={to} className="zlink-metric" data-tone={tone}>
    <span className="zlink-metric-heading"><span className="zlink-metric-icon"><Icon aria-hidden="true" /></span><ArrowUpRight aria-hidden="true" /></span>
    <span className="zlink-metric-label">{label}</span>
    <strong>{value}{unit && <small>{unit}</small>}</strong>
    <p>{detail}</p>
  </Link>;
}

function DocumentPreview({ label, title, body, footer, version }: {
  label: string; title: string; body: string; footer: ReactNode; version?: number;
}) {
  return <>
    <span className="zlink-file-label"><FileText aria-hidden="true" />{label}{version !== undefined && <span>v{version}</span>}</span>
    <div className="zlink-document-sheet"><span className="zlink-document-heading"><FileText aria-hidden="true" /><span>内容预览</span></span><h3>{title}</h3><p className="zlink-document-excerpt">{body}</p></div>
    <span className="zlink-document-footer"><span>{footer}</span><span className="zlink-document-open"><ArrowUpRight aria-hidden="true" /></span></span>
  </>;
}

const ADAPTER_LABELS: Record<string, string> = {
  codex_local: "Codex 本地执行", claude_local: "Claude 本地执行", gemini_local: "Gemini 本地执行",
};

interface ZLinkDashboardProps {
  companyId: string;
  companyName: string;
  summary?: DashboardSummary;
  issues?: Issue[];
  agents?: Agent[];
  issuesError?: Error | null;
  agentsError?: Error | null;
  notices: ReactNode;
  activity: ReactNode;
  runs: ReactNode;
  charts: ReactNode;
  plugins: ReactNode;
  onNewTask: () => void;
}

/** A presentation of the existing company data; no execution or approval mutations. */
export function ZLinkDashboard({ companyId, companyName, summary, issues, agents, issuesError, agentsError, notices, activity, runs, charts, plugins, onNewTask }: ZLinkDashboardProps) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [search, setSearch] = useState("");
  const discussions = (issues ?? []).filter(issue => issue.workMode === "discussion" && issue.status !== "cancelled" && issue.status !== "done");
  const ordered = (issues ?? []).filter(issue => issue.workMode !== "discussion").sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
  const review = ordered.filter(issue => issue.status === "in_review");
  const blocked = ordered.filter(issue => issue.status === "blocked");
  const active = ordered.filter(issue => issue.status === "in_progress");
  const visible = ordered.filter(issue => {
    const matchesFilter = filter === "all" || (filter === "active" ? issue.status === "in_progress" : issue.status === "in_review");
    return matchesFilter && `${issue.title} ${issue.identifier ?? ""}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase());
  });
  const { data: artifacts, isLoading: artifactsLoading, error: artifactsError } = useQuery({
    queryKey: [...queryKeys.artifacts.list(companyId), "dashboard", { limit: 3 }],
    queryFn: () => artifactsApi.list(companyId, { limit: 3 }),
  });
  // Reuse the canonical document cache, including board-saved task documents
  // omitted by the agent-only gallery. Bound reads to three completed tasks.
  const completed = ordered.filter(issue => issue.status === "done").slice(0, 3);
  const documentQueries = useQueries({ queries: completed.map(issue => ({
    queryKey: queryKeys.issues.documents(issue.id),
    queryFn: () => issuesApi.listDocuments(issue.id),
    enabled: artifacts !== undefined && artifacts.artifacts.length === 0,
  })) });
  const documents = completed.flatMap((issue, index) => (documentQueries[index]?.data ?? []).map(document => ({ issue, document })))
    .sort((a, b) => +new Date(b.document.updatedAt) - +new Date(a.document.updatedAt)).slice(0, 3);
  const documentsLoading = artifacts?.artifacts.length === 0 && documentQueries.some(query => query.isLoading);
  const documentsError = documentQueries.some(query => query.isError);
  const pendingApprovals = summary ? summary.pendingApprovals + summary.budgets.pendingApprovals : 0;
  const attention = [...blocked, ...review].slice(0, 3);
  const countFor = (id: string) => id === "all" ? ordered.length : id === "active" ? active.length : review.length;

  return <div className="zlink-dashboard">
    <header className="zlink-home-header">
      <div>
        <p className="zlink-context"><span className="zlink-workspace-mark" aria-hidden="true"><img src="/brands/zlink/mark.png" alt="" /></span>{companyName}<span className="zlink-workspace-label">业务工作台</span></p>
        <h1>今天的工作</h1>
        <p className="zlink-intro">任务有进展，成果有着落。这里是你与 Agent 团队的工作现场。</p>
      </div>
      <div className="zlink-header-actions">
        <span className="zlink-date"><CalendarDays aria-hidden="true" />{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "long", timeZone: "Asia/Shanghai" }).format(new Date())}</span>
        <Button onClick={onNewTask} className="zlink-create-button"><Plus aria-hidden="true" />新建任务</Button>
      </div>
    </header>

    {notices}

    {summary && <section className="zlink-metrics" aria-label="业务概况">
      <MetricCard to="/issues?status=in_progress" label="正在推进" value={summary.tasks.inProgress} unit="项任务" detail={`${summary.tasks.open} 项未完成任务`} icon={Workflow} tone="primary" />
      <MetricCard to="/inbox" label="需要关注" value={review.length + blocked.length + pendingApprovals} unit="项事项" detail={`${review.length} 待审阅 · ${blocked.length} 受阻 · ${pendingApprovals} 待批准`} icon={Inbox} tone="attention" />
      <MetricCard to="/issues?status=done" label="已完成" value={summary.tasks.done} unit="项任务" detail="成果与执行记录随任务保留" icon={CircleCheck} tone="success" />
      <MetricCard to="/costs" label="本月已上报费用" value={formatCents(summary.costs.monthSpendCents)} detail="订阅额度不计入此处" icon={CircleDollarSign} tone="cost" />
    </section>}

    <section className="zlink-attention" aria-label="需要关注的事项">
      <span className="zlink-attention-icon">{attention.length || pendingApprovals || issuesError ? <Inbox aria-hidden="true" /> : <CircleCheck aria-hidden="true" />}</span>
      <div><h2>{issuesError ? "任务状态暂时读取失败" : attention.length || pendingApprovals ? "有些事情需要关注" : issues ? "当前没有待审阅或受阻的任务" : "正在读取任务状态"}</h2>
        <p>{attention.length || pendingApprovals ? "查看待审阅、受阻的任务与审批，继续推进交付。" : "新任务可以直接交给 Agent，完成后在这里查看结果。"}</p>
        {attention.length > 0 && <div className="zlink-attention-links">{attention.map(issue => <Link key={issue.id} to={`/issues/${issue.identifier ?? issue.id}`}><StatusIcon status={issue.status} />{issue.title}</Link>)}</div>}
      </div>
      <Link to="/inbox" className="zlink-text-link">打开收件箱<ArrowUpRight aria-hidden="true" /></Link>
    </section>

    {discussions.length > 0 && <section aria-label="日常沟通">
      <Card className="zlink-task-panel">
        <div className="zlink-section-heading"><div><h2>日常沟通<span className="zlink-section-count">{discussions.length}</span></h2><p>收到留言才唤醒，具体工作进入独立执行任务。</p></div></div>
        <div className="zlink-task-list">{discussions.map(issue => <Link key={issue.id} to={`/issues/${issue.identifier ?? issue.id}`} className="zlink-task-row" disableIssueQuicklook>
          <span className="zlink-task-status-icon"><Inbox aria-hidden="true" /></span>
          <div className="zlink-task-copy"><h3>{issue.title}</h3><div className="zlink-task-meta"><span>{issue.identifier}</span></div></div>
          <span className="zlink-status">{issue.status === "in_review" ? "等待留言" : issue.status === "blocked" ? "需要处理" : "待回复"}</span><ArrowUpRight className="zlink-row-arrow" aria-hidden="true" />
        </Link>)}</div>
      </Card>
    </section>}

    {!!summary?.agents.running && runs}
    <div className="zlink-work-grid">
      <Card className="zlink-task-panel">
        <div className="zlink-section-heading"><div><h2>任务<span className="zlink-section-count">{ordered.length}</span></h2><p>正在发生的工作，以及最近的交付。</p></div><Link to="/issues" className="zlink-text-link">全部任务<ArrowUpRight aria-hidden="true" /></Link></div>
        <div className="zlink-task-toolbar">
          <div className="zlink-filters" role="group" aria-label="筛选任务">{FILTERS.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{countFor(item.id)}</span></button>)}</div>
          <label className="zlink-search"><Search aria-hidden="true" /><input aria-label="搜索首页任务" placeholder="搜索任务" value={search} onChange={event => setSearch(event.target.value)} /></label>
        </div>
        <div className="zlink-task-list">
          {issuesError ? <p className="zlink-empty text-destructive">{issuesError.message}</p> : issues === undefined ? <p className="zlink-empty">正在读取任务…</p> : visible.length === 0 ? <div className="zlink-empty"><CircleCheck aria-hidden="true" /><p>{search ? "没有找到匹配的任务。" : filter === "all" ? "还没有任务。新建一个，把工作交给 Agent。" : filter === "active" ? "当前没有正在执行的任务。" : "当前没有待审阅的任务。"}</p>{search && <button onClick={() => setSearch("")}>清除搜索</button>}</div> : visible.slice(0, 6).map(issue => {
            const agent = agents?.find(item => item.id === issue.assigneeAgentId);
            return <Link key={issue.id} to={`/issues/${issue.identifier ?? issue.id}`} className="zlink-task-row" disableIssueQuicklook>
              <span className="zlink-task-status-icon"><StatusIcon status={issue.status} externalConversationState={issue.externalConversationState} blockerAttention={issue.blockerAttention} /></span>
              <div className="zlink-task-copy"><h3>{issue.title}</h3><div className="zlink-task-meta"><span>{issue.identifier}</span>{agent && <AgentIdentity agent={agent} size="sm" />}<span>更新于 {updatedDate(issue.updatedAt)}</span></div></div>
              <span className="zlink-status" data-status={issue.status}>{STATUS_LABELS[issue.status] ?? issue.status}</span><ArrowUpRight className="zlink-row-arrow" aria-hidden="true" />
            </Link>;
          })}
        </div>
        <div className="zlink-task-panel-footer"><span>{ordered.length ? `共 ${ordered.length} 项任务` : "任务记录会保留在这里"}</span><Link to="/projects" className="zlink-text-link">查看项目<ArrowUpRight aria-hidden="true" /></Link></div>
      </Card>

      <Card className="zlink-deliverables">
        <div className="zlink-section-heading"><div><h2>最近成果</h2><p>每一份交付，都可以接着使用。</p></div><span className="zlink-section-icon"><Sparkles aria-hidden="true" /></span></div>
        {artifactsLoading || documentsLoading ? <p className="zlink-empty">正在读取成果…</p> : artifactsError || documentsError ? <p className="zlink-empty text-destructive">成果暂时读取失败，请稍后重试或打开任务查看。</p> : artifacts?.artifacts.length ? artifacts.artifacts.map(artifact => <Link key={artifact.id} to={artifact.href} className="zlink-deliverable" disableIssueQuicklook><DocumentPreview label="任务成果" title={artifact.title} body={artifact.previewText ?? "打开查看文件及完整内容。"} footer={artifact.issue.identifier} /></Link>) : documents.length ? documents.map(({ issue, document }) => <Link key={document.id} to={`/issues/${issue.identifier ?? issue.id}#document-${document.key}`} className="zlink-deliverable" disableIssueQuicklook><DocumentPreview label="任务文档" title={document.title ?? issue.title} body={document.body.replace(/^#+\s+.*$/gm, "").replace(/[|*_`]/g, "").trim().slice(0, 220)} version={document.latestRevisionNumber} footer={<>{issue.identifier} · {updatedDate(document.updatedAt)}</>} /></Link>) : <div className="zlink-empty"><FileText aria-hidden="true" /><p>任务生成的文档和文件会显示在这里。</p></div>}
        <Link to="/artifacts" className="zlink-deliverables-footer">浏览成果库<ArrowUpRight aria-hidden="true" /></Link>
      </Card>
      <Card className="zlink-team-panel"><div className="zlink-section-heading"><div><h2>Agent 团队</h2><p>{agentsError ? "团队信息暂时读取失败" : agents ? `${agents.filter(agent => agent.status !== "terminated").length} 位 Agent · ${summary?.agents.running ?? 0} 位正在执行` : "正在读取团队信息…"}</p></div><Link to="/agents" className="zlink-text-link">管理团队<ArrowUpRight aria-hidden="true" /></Link></div><div className="zlink-team-list">{agents?.filter(agent => agent.status !== "terminated").map(agent => <Link key={agent.id} to={`/agents/${agent.id}`} className="zlink-team-member"><div className="zlink-member-copy"><AgentIdentity agent={agent} size="sm" /><span className="zlink-member-detail">{ADAPTER_LABELS[agent.adapterType] ?? agent.title ?? "业务 Agent"}</span></div><span className="zlink-agent-state" data-status={agent.status}><span aria-hidden="true" />{({ running: "执行中", idle: "空闲", active: "就绪", paused: "已暂停", error: "异常" } as Record<string, string>)[agent.status] ?? agent.status}</span></Link>)}</div></Card>
    </div>

    {plugins}
    <details className="zlink-detail-section"><summary><span>执行概况与统计</span><ChevronDown aria-hidden="true" /></summary><div className="zlink-secondary-content">{summary?.agents.running ? null : runs}{charts}</div></details>
    <details className="zlink-detail-section"><summary><span>最近活动</span><ChevronDown aria-hidden="true" /></summary><div className="zlink-secondary-content">{activity}</div></details>
    <footer className="zlink-home-footer"><span><Check aria-hidden="true" />连接当前公司的真实任务与成果</span><span>执行记录随任务保留</span></footer>
  </div>;
}
