"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Clock3,
  Globe2,
  Inbox,
  Layers3,
  Megaphone,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import { normalizeAgent, normalizeProject, normalizeTask, readApiData } from "@/lib/client-normalizers";
import type { Agent, Project, Task } from "@/lib/types";

type OwnerInbox = {
  pendingApprovals?: Task[];
  blockedTasks?: Task[];
  todayDone?: Task[];
  recentDeliverables?: Array<Record<string, any>>;
  highRiskItems?: Task[];
  pendingContentApprovals?: Array<Record<string, any>>;
  recentContentNotifications?: Array<Record<string, any>>;
};

type ClientSummary = {
  key: string;
  name: string;
  projects: Project[];
  tasks: Task[];
  progress: number;
  health: "good" | "warn" | "risk";
  services: string[];
};

const serviceRules = [
  { name: "社媒代运营", icon: Megaphone, match: /social|社媒|小红书|linkedin|content|内容/i },
  { name: "SEO 运营", icon: Search, match: /seo|关键词|搜索|站内/i },
  { name: "广告投放", icon: Sparkles, match: /ads?|广告|投放|campaign/i },
  { name: "网站建设维护", icon: Globe2, match: /web|site|wordpress|网站|建站|页面/i }
];

function taskText(task: Task) {
  return `${task.title} ${task.description} ${task.taskType ?? ""} ${(task.suggestedSkills ?? []).join(" ")}`;
}

function servicesFor(tasks: Task[], projects: Project[]) {
  const text = `${tasks.map(taskText).join(" ")} ${projects.map((project) => `${project.name} ${project.objective} ${project.clientProfile}`).join(" ")}`;
  const matches = serviceRules.filter((rule) => rule.match.test(text)).map((rule) => rule.name);
  return matches.length ? matches : ["综合运营"];
}

function useStudioData() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [inbox, setInbox] = useState<OwnerInbox>({});
  const [message, setMessage] = useState("正在连接工作室数据...");

  useEffect(() => {
    Promise.all([
      fetch("/api/projects").then((response) => readApiData<any[]>(response)),
      fetch("/api/tasks").then((response) => readApiData<any[]>(response)),
      fetch("/api/agents").then((response) => readApiData<any[]>(response))
    ])
      .then(([projectRows, taskRows, agentRows]) => {
        setProjects(projectRows.map(normalizeProject));
        setTasks(taskRows.map(normalizeTask));
        setAgents(agentRows.map(normalizeAgent));
        setMessage("实时数据已同步");
      })
      .catch((error) => setMessage(error instanceof Error ? error.message : "数据连接失败"));

    fetch("/api/owner-inbox")
      .then((response) => readApiData<OwnerInbox>(response))
      .then(setInbox)
      .catch(() => undefined);
  }, []);

  const clients = useMemo<ClientSummary[]>(() => {
    const groups = new Map<string, Project[]>();
    projects.forEach((project) => {
      const name = project.clientName.trim() || "自有品牌";
      groups.set(name, [...(groups.get(name) ?? []), project]);
    });
    return Array.from(groups.entries()).map(([name, clientProjects]) => {
      const ids = new Set(clientProjects.map((project) => project.id));
      const clientTasks = tasks.filter((task) => (task.projectId && ids.has(task.projectId)) || task.clientName === name);
      const progress = clientProjects.length ? Math.round(clientProjects.reduce((sum, item) => sum + item.progress, 0) / clientProjects.length) : 0;
      const riskCount = clientTasks.filter((task) => task.status === "blocked" || ["high", "critical"].includes(task.riskLevel)).length;
      return {
        key: encodeURIComponent(name),
        name,
        projects: clientProjects,
        tasks: clientTasks,
        progress,
        health: riskCount > 1 ? "risk" : riskCount === 1 ? "warn" : "good",
        services: servicesFor(clientTasks, clientProjects)
      };
    });
  }, [projects, tasks]);

  return { projects, tasks, agents, inbox, clients, message };
}

function LiveState({ text }: { text: string }) {
  return <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-line bg-white/[0.02] px-3 text-[10px] text-moss"><i className="h-1.5 w-1.5 rounded-full bg-[#49c98d]" />{text}</span>;
}

function Empty({ children }: { children: string }) {
  return <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-[11px] leading-5 text-moss/60">{children}</div>;
}

function Health({ value }: { value: ClientSummary["health"] }) {
  const meta = value === "good" ? ["#49c98d", "运行健康"] : value === "warn" ? ["#e6ad62", "需要关注"] : ["#eb7777", "存在风险"];
  return <span className="inline-flex items-center gap-2 text-[10px] text-moss"><i className="h-1.5 w-1.5 rounded-full" style={{ background: meta[0] }} />{meta[1]}</span>;
}

export function ClientsWorkspace() {
  const { clients, tasks, message } = useStudioData();
  const active = clients.filter((client) => client.progress < 100).length;
  const awaiting = tasks.filter((task) => task.approvalStatus === "pending").length;

  return (
    <>
      <PageHeader eyebrow="Client Operations" title="客户" description="按客户查看已签服务、执行健康度和交付进度。Agent 团队从这里获得稳定的客户上下文。" action={<Link href="/projects" className="inline-flex h-8 items-center gap-2 rounded-lg bg-[#e9e5dd] px-3 text-[10px] font-semibold text-[#222125]"><Plus size={13} />新建客户项目</Link>} />
      <section className="mb-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniMetric label="客户总数" value={clients.length} hint="已建立真实项目关系" />
        <MiniMetric label="活跃服务" value={active} hint="正在持续执行" />
        <MiniMetric label="待 Owner 决策" value={awaiting} hint="受审批门保护" />
        <MiniMetric label="平均健康度" value={clients.length ? `${Math.round(clients.reduce((sum, item) => sum + item.progress, 0) / clients.length)}%` : "—"} hint={message} />
      </section>
      {clients.length ? <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{clients.map((client) => <ClientCard key={client.key} client={client} />)}</section> : <Panel><Empty>还没有客户数据。先新建一个客户项目，客户会自动进入这里，不会产生孤立的演示数据。</Empty></Panel>}
    </>
  );
}

function ClientCard({ client }: { client: ClientSummary }) {
  const done = client.tasks.filter((task) => task.status === "done").length;
  return (
    <Link href={`/clients/${client.key}`} className="glass-panel group rounded-2xl p-5 transition hover:border-white/[0.14] hover:bg-white/[0.032]">
      <div className="flex items-start justify-between gap-4"><span className="grid h-9 w-9 place-items-center rounded-lg border border-line bg-white/[0.035] text-[11px] font-semibold text-moss">{client.name.slice(0, 2).toUpperCase()}</span><Health value={client.health} /></div>
      <h3 className="mt-4 text-[16px] font-medium tracking-tight">{client.name}</h3>
      <p className="mt-1 text-[10px] text-moss/55">{client.projects.length} 个项目 · {client.tasks.length} 项执行任务</p>
      <div className="mt-4 flex flex-wrap gap-1.5">{client.services.map((service) => <span key={service} className="rounded-md border border-line bg-white/[0.02] px-2 py-1 text-[9px] text-moss">{service}</span>)}</div>
      <div className="mt-5 grid grid-cols-3 gap-2 border-t border-line pt-4"><TinyStat value={`${client.progress}%`} label="总进度" /><TinyStat value={String(done)} label="已完成" /><TinyStat value={String(client.tasks.length - done)} label="待推进" /></div>
      <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.06]"><i className="block h-full bg-gradient-to-r from-[#605ed2] to-[#8e88ff]" style={{ width: `${client.progress}%` }} /></div>
      <div className="mt-4 flex items-center justify-end gap-1 text-[9px] text-moss/45 transition group-hover:text-[#aaa8ff]">进入客户作战室 <ArrowRight size={12} /></div>
    </Link>
  );
}

export function ClientDetailWorkspace({ clientKey }: { clientKey: string }) {
  const { clients, agents, message } = useStudioData();
  const name = decodeURIComponent(clientKey);
  const client = clients.find((item) => item.name === name);
  if (!client) return <><PageHeader eyebrow="Client Operations" title={name} description="正在读取客户作战室..." action={<LiveState text={message} />} /><Panel><Empty>未找到该客户，或数据仍在同步。</Empty></Panel></>;
  const activeAgents = agents.filter((agent) => client.projects.some((project) => project.agentIds.includes(agent.id)) || client.tasks.some((task) => task.assignedAgentId === agent.id));
  return (
    <>
      <PageHeader eyebrow="Client War Room" title={client.name} description={`${client.services.join(" · ")}。这里聚合项目目标、服务线、Agent 分工和下一步执行。`} action={<LiveState text={message} />} />
      <section className="mb-3 grid gap-3 sm:grid-cols-3"><MiniMetric label="综合进度" value={`${client.progress}%`} hint={`${client.projects.length} 个关联项目`} /><MiniMetric label="执行任务" value={client.tasks.length} hint={`${client.tasks.filter((item) => item.status === "done").length} 项已完成`} /><MiniMetric label="Agent 编组" value={activeAgents.length} hint={activeAgents.map((item) => item.name).join(" · ") || "等待分配"} /></section>
      <section className="grid gap-3 xl:grid-cols-[minmax(0,1.5fr)_360px]">
        <Panel title="服务执行线" description="每条服务线显示真实任务数量、阻塞和下一步。">
          <div className="divide-y divide-line">{client.services.map((service) => {
            const rule = serviceRules.find((item) => item.name === service); const Icon = rule?.icon ?? Layers3;
            const laneTasks = rule ? client.tasks.filter((task) => rule.match.test(taskText(task))) : client.tasks;
            const current = laneTasks.find((task) => !["done", "cancelled"].includes(task.status));
            return <div key={service} className="py-4 first:pt-0 last:pb-0"><div className="grid gap-3 md:grid-cols-[150px_1fr_110px] md:items-center"><span className="flex items-center gap-2 text-[11px] font-medium"><Icon size={14} className="text-[#8986ff]" />{service}</span><span className="text-[10px] text-moss">下一步：<b className="font-medium text-ink/75">{current?.title ?? "当前批次已完成"}</b></span><span className="text-right text-[10px] text-moss">{laneTasks.filter((task) => task.status === "done").length}/{laneTasks.length} 完成</span></div></div>;
          })}</div>
        </Panel>
        <Panel title="客户经理 Agent" description="负责上下文、节奏和跨服务线协调。"><div className="py-3 text-center"><div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-[#7774ff]/25 bg-[#7774ff]/10 text-sm text-[#c6c4ff]">{activeAgents[0]?.name?.slice(0, 2) ?? "Ki"}</div><h3 className="mt-4 text-[13px] font-medium">{activeAgents[0]?.name ?? "Kiki"}</h3><p className="mt-1 text-[9px] text-moss">{activeAgents[0]?.title ?? "执行经理 Agent"}</p></div><div className="mt-3 divide-y divide-line border-t border-line">{client.projects.slice(0, 4).map((project) => <Link key={project.id} href={`/projects/${project.id}`} className="flex items-center justify-between py-3 text-[10px] text-moss hover:text-ink"><span>{project.name}</span><span>{project.progress}%</span></Link>)}</div></Panel>
      </section>
    </>
  );
}

export function OperationsWorkspace() {
  const { clients, tasks, message } = useStudioData();
  const lanes = serviceRules.map((rule) => ({ ...rule, tasks: tasks.filter((task) => rule.match.test(taskText(task))) }));
  return <><PageHeader eyebrow="Service Operations" title="服务运营" description="跨客户查看社媒、SEO、广告与网站四条生产线，让 Agent 按服务 SOP 持续执行。" action={<LiveState text={message} />} /><section className="grid gap-3 xl:grid-cols-2">{lanes.map((lane) => <Panel key={lane.name} title={lane.name} description={`${lane.tasks.length} 项真实任务 · ${clients.filter((client) => client.services.includes(lane.name)).length} 个客户`}><div className="space-y-2">{lane.tasks.slice(0, 6).map((task) => <TaskLine key={task.id} task={task} client={clients.find((item) => item.tasks.some((candidate) => candidate.id === task.id))?.name} />)}{!lane.tasks.length ? <Empty>当前没有这条服务线的任务。</Empty> : null}</div></Panel>)}</section></>;
}

export function CalendarWorkspace() {
  const { tasks, clients, message } = useStudioData();
  const scheduled = [...tasks].filter((task) => task.dueAt).sort((a, b) => String(a.dueAt).localeCompare(String(b.dueAt)));
  const buckets = scheduled.reduce<Record<string, Task[]>>((map, task) => { const day = String(task.dueAt).slice(0, 10); map[day] = [...(map[day] ?? []), task]; return map; }, {});
  return <><PageHeader eyebrow="Delivery Calendar" title="运营日历" description="统一查看客户交付、内容排期、审核节点和截止日期。" action={<LiveState text={message} />} /><section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_340px]"><Panel title="交付时间线" description="来自真实任务截止时间。"><div className="space-y-5">{Object.entries(buckets).map(([day, items]) => <div key={day} className="grid gap-3 sm:grid-cols-[105px_1fr]"><div><p className="font-mono text-[11px] text-[#9996ff]">{day}</p><p className="mt-1 text-[9px] text-moss/50">{items.length} 个节点</p></div><div className="space-y-2">{items.map((task) => <TaskLine key={task.id} task={task} client={clients.find((item) => item.tasks.some((candidate) => candidate.id === task.id))?.name} />)}</div></div>)}{!scheduled.length ? <Empty>尚未设置任务截止时间。为任务添加 due date 后会自动进入运营日历。</Empty> : null}</div></Panel><Panel title="排期规则" description="Agent 默认遵循的交付纪律。"><Rule icon={ShieldCheck} title="客户外发需审批" text="客户账号发布与高风险外部动作进入 L2 审批。" /><Rule icon={CalendarClock} title="提前 24 小时预警" text="临近截止且未完成的任务进入 Owner Inbox。" /><Rule icon={CheckCircle2} title="完成即沉淀" text="交付物、复盘和客户上下文自动进入公司大脑。" /></Panel></section></>;
}

export function InboxWorkspace() {
  const { inbox, message } = useStudioData();
  const approvals = [...(inbox.pendingApprovals ?? []), ...(inbox.pendingContentApprovals ?? [])];
  return <><PageHeader eyebrow="Decision Center" title="Owner Inbox" description="这里只保留需要你判断的事项；可自动执行的工作不会来打扰你。" action={<LiveState text={message} />} /><section className="mb-3 grid gap-3 sm:grid-cols-3"><MiniMetric label="待审批" value={approvals.length} hint="需要 Owner 决策" /><MiniMetric label="阻塞" value={inbox.blockedTasks?.length ?? 0} hint="Agent 无法自行继续" /><MiniMetric label="今日完成" value={inbox.todayDone?.length ?? 0} hint="仅通知，不需处理" /></section><section className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]"><Panel title="待你决策" description="审批通过后，Agent 会自动继续执行。"><div className="space-y-2">{approvals.map((item: any) => <div key={item.id} className="rounded-xl border border-line bg-white/[0.018] p-4"><div className="flex items-center gap-2 text-[9px] text-moss"><span className="rounded bg-[#e6ad62]/10 px-1.5 py-1 font-mono text-[#d5a865]">{item.approvalLevel ?? item.approval_level ?? "L2"}</span><span>{item.clientName ?? item.client_name ?? item.platform ?? "工作室"}</span></div><h4 className="mt-2 text-[11px] font-medium">{item.title}</h4><p className="mt-1 line-clamp-2 text-[10px] leading-5 text-moss">{item.description ?? item.caption ?? "等待 Owner 确认后继续执行。"}</p><Link href={item.projectId || item.project_id ? `/projects/${item.projectId ?? item.project_id}` : "/tasks"} className="mt-3 inline-flex items-center gap-1 text-[9px] text-[#aaa8ff]">进入处理 <ArrowRight size={11} /></Link></div>)}{!approvals.length ? <Empty>当前没有需要你审批的事项，Agent 正在按权限自主执行。</Empty> : null}</div></Panel><Panel title="风险与通知" description="只有异常、阻塞和关键完成会出现在这里。"><div className="space-y-2">{(inbox.blockedTasks ?? []).map((task) => <TaskLine key={task.id} task={task} />)}{(inbox.recentContentNotifications ?? []).slice(0, 4).map((item: any) => <div key={item.id} className="flex gap-3 rounded-xl border border-line p-3"><CheckCircle2 size={14} className="mt-0.5 shrink-0 text-[#49c98d]" /><div><p className="text-[10px] text-ink/80">{item.title}</p><p className="mt-1 text-[9px] text-moss">已完成发布</p></div></div>)}{!(inbox.blockedTasks?.length || inbox.recentContentNotifications?.length) ? <Empty>没有风险或异常通知。</Empty> : null}</div></Panel></section></>;
}

function MiniMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return <div className="glass-panel min-h-[112px] rounded-2xl p-4"><p className="text-[10px] text-moss">{label}</p><p className="mt-4 text-[27px] font-medium tracking-[-0.04em]">{value}</p><p className="mt-1 text-[9px] text-moss/50">{hint}</p></div>;
}
function TinyStat({ value, label }: { value: string; label: string }) { return <div><strong className="block text-[13px] font-medium">{value}</strong><span className="text-[8px] text-moss/50">{label}</span></div>; }
function TaskLine({ task, client }: { task: Task; client?: string }) { return <div className="flex items-center gap-3 rounded-xl border border-line bg-white/[0.018] p-3"><CircleDot size={13} className={task.status === "blocked" ? "text-[#eb7777]" : task.status === "done" ? "text-[#49c98d]" : "text-[#8986ff]"} /><div className="min-w-0 flex-1"><p className="truncate text-[10px] text-ink/80">{task.title}</p><p className="mt-1 truncate text-[9px] text-moss/50">{client ?? task.clientName ?? "内部运营"}{task.dueAt ? ` · ${String(task.dueAt).slice(0, 10)}` : ""}</p></div><StatusBadge value={task.status} /></div>; }
function Rule({ icon: Icon, title, text }: { icon: typeof ShieldCheck; title: string; text: string }) { return <div className="flex gap-3 border-t border-line py-4 first:border-0 first:pt-0"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-line bg-white/[0.025] text-[#8986ff]"><Icon size={14} /></span><div><p className="text-[10px] font-medium">{title}</p><p className="mt-1 text-[9px] leading-4 text-moss">{text}</p></div></div>; }
