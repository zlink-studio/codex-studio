"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  FileText,
  Link2,
  Plus,
  Search,
  Upload,
  XCircle
} from "lucide-react";
import { PageHeader } from "@/components/page-header";
import {
  normalizeAgent,
  normalizeKnowledgeSource,
  normalizeMemory,
  normalizeMemoryAccessLog,
  normalizeMemoryCategory,
  normalizeMemoryRelation,
  normalizeProject,
  readApiData
} from "@/lib/client-normalizers";
import type {
  Agent,
  KnowledgeSource,
  Memory,
  MemoryAccessLog,
  MemoryCategory,
  MemoryRelation,
  Project
} from "@/lib/types";

type ReviewQueueRow = {
  id: string;
  memory_id?: string;
  memoryId?: string;
  reason: string;
  risk_level?: string;
  riskLevel?: string;
  review_status?: string;
  created_at?: string;
  memory?: Record<string, unknown>;
};

const rootTreeItems = [
  { id: "company", label: "公司记忆", type: "company" },
  { id: "client", label: "客户记忆", type: "client" },
  { id: "project", label: "项目记忆", type: "project" },
  { id: "agent", label: "员工记忆", type: "agent" },
  { id: "sop", label: "SOP 流程库", type: "sop" },
  { id: "review", label: "复盘经验库", type: "review" },
  { id: "source", label: "外部知识源", type: "source" },
  { id: "pending_review", label: "待审核记忆", type: "pending_review" }
];

const initialMemoryForm = {
  id: "",
  title: "",
  type: "company",
  scope: "global",
  category_id: "",
  client_name: "",
  project_id: "",
  agent_id: "",
  source_type: "manual",
  source_id: "",
  source_url: "",
  visibility: "owner",
  importance: "3",
  confidence: "0.8",
  tags: "",
  summary: "",
  content: ""
};

const initialSourceForm = {
  name: "",
  type: "manual",
  source_url: ""
};

const statusLabels: Record<string, string> = {
  approved: "已通过",
  pending_review: "待审核",
  draft: "草稿",
  archived: "已归档",
  rejected: "已拒绝",
  all: "全部状态"
};

const sourceTypeLabels: Record<string, string> = {
  manual: "手动录入",
  task: "任务沉淀",
  meeting: "会议纪要",
  upload: "上传文件",
  wps: "WPS",
  notion: "Notion",
  kdocs: "金山文档",
  google_drive: "Google Drive",
  feishu: "飞书",
  url: "网页链接",
  file: "文件",
  email: "邮件",
  agent_run: "员工执行"
};

const memoryTypeLabels: Record<string, string> = {
  all: "全部类型",
  company: "公司",
  client: "客户",
  project: "项目",
  agent: "员工",
  sop: "SOP",
  review: "复盘"
};

const projectFilterBaseLabels: Record<string, string> = {
  all: "全部项目"
};

const clientFilterLabels: Record<string, string> = {
  all: "全部客户"
};

export function MemoryWorkspace() {
  const [items, setItems] = useState<Memory[]>([]);
  const [categories, setCategories] = useState<MemoryCategory[]>([]);
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [logs, setLogs] = useState<MemoryAccessLog[]>([]);
  const [relations, setRelations] = useState<MemoryRelation[]>([]);
  const [queue, setQueue] = useState<ReviewQueueRow[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedTree, setSelectedTree] = useState("all");
  const [selectedMemoryId, setSelectedMemoryId] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [isEditing, setIsEditing] = useState(false);
  const [memoryForm, setMemoryForm] = useState(initialMemoryForm);
  const [sourceForm, setSourceForm] = useState(initialSourceForm);
  const [message, setMessage] = useState("正在加载记忆库...");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    void refresh();
  }, []);

  const selectedMemory = items.find((memory) => memory.id === selectedMemoryId) ?? items[0] ?? null;
  const categoryById = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories]
  );
  const sourceById = useMemo(
    () => new Map(sources.map((source) => [source.id, source])),
    [sources]
  );
  const selectedLogs = useMemo(
    () => logs.filter((log) => log.memoryId === selectedMemory?.id),
    [logs, selectedMemory?.id]
  );
  const selectedRelations = useMemo(
    () => relations.filter((relation) => relation.memoryId === selectedMemory?.id),
    [relations, selectedMemory?.id]
  );

  const statusStats = useMemo(() => countBy(items, (memory) => memory.status ?? "approved"), [items]);
  const sourceStats = useMemo(() => countBy(items, (memory) => memory.sourceType ?? "manual"), [items]);
  const clients = useMemo(
    () => Array.from(new Set(items.map((memory) => memory.clientName).filter(Boolean))) as string[],
    [items]
  );

  const visibleItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((memory) => {
        if (selectedTree === "all") return true;
        if (selectedTree === "pending_review") return memory.status === "pending_review";
        if (selectedTree.startsWith("category:")) return memory.categoryId === selectedTree.replace("category:", "");
        if (selectedTree === "source") return true;
        return memory.type === selectedTree;
      })
      .filter((memory) => typeFilter === "all" || memory.type === typeFilter)
      .filter((memory) => statusFilter === "all" || (memory.status ?? "approved") === statusFilter)
      .filter((memory) => clientFilter === "all" || memory.clientName === clientFilter)
      .filter((memory) => projectFilter === "all" || memory.projectId === projectFilter)
      .filter((memory) => {
        if (!q) return true;
        const text = `${memory.title} ${memory.summary ?? ""} ${memory.content} ${memory.tags.join(" ")}`;
        return text.toLowerCase().includes(q);
      });
  }, [clientFilter, items, projectFilter, query, selectedTree, statusFilter, typeFilter]);

  async function refresh() {
    try {
      const [memoryRows, categoryRows, sourceRows, logRows, relationRows, queueRows, agentRows, projectRows] =
        await Promise.all([
          fetch("/api/memories").then((response) => readApiData<any[]>(response)),
          fetch("/api/memory-categories").then((response) => readApiData<any[]>(response)).catch(() => []),
          fetch("/api/knowledge-sources").then((response) => readApiData<any[]>(response)).catch(() => []),
          fetch("/api/memory-access-logs").then((response) => readApiData<any[]>(response)).catch(() => []),
          fetch("/api/memory-relations").then((response) => readApiData<any[]>(response)).catch(() => []),
          fetch("/api/memory-review-queue").then((response) => readApiData<ReviewQueueRow[]>(response)).catch(() => []),
          fetch("/api/agents").then((response) => readApiData<any[]>(response)).catch(() => []),
          fetch("/api/projects").then((response) => readApiData<any[]>(response)).catch(() => [])
        ]);

      const nextMemories = memoryRows.map(normalizeMemory);
      setItems(nextMemories);
      setCategories(categoryRows.map(normalizeMemoryCategory));
      setSources(sourceRows.map(normalizeKnowledgeSource));
      setLogs(logRows.map(normalizeMemoryAccessLog));
      setRelations(relationRows.map(normalizeMemoryRelation));
      setQueue(queueRows);
      setAgents(agentRows.map(normalizeAgent));
      setProjects(projectRows.map(normalizeProject));
      setSelectedMemoryId((current) => current || nextMemories[0]?.id || "");
      setMessage(`已同步 ${nextMemories.length} 条记忆、${sourceRows.length} 个知识源。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载失败");
    }
  }

  function startCreate() {
    setMemoryForm(initialMemoryForm);
    setIsEditing(true);
    setMessage("开始新建记忆。");
  }

  function startEdit(memory: Memory) {
    setMemoryForm({
      id: memory.id,
      title: memory.title,
      type: memory.type,
      scope: memory.scope ?? "global",
      category_id: memory.categoryId ?? "",
      client_name: memory.clientName ?? "",
      project_id: memory.projectId ?? "",
      agent_id: memory.agentId ?? "",
      source_type: memory.sourceType ?? "manual",
      source_id: memory.sourceId ?? "",
      source_url: memory.sourceUrl ?? "",
      visibility: memory.visibility ?? "owner",
      importance: String(memory.importance ?? 3),
      confidence: String(memory.confidence ?? 0.8),
      tags: memory.tags.join(", "),
      summary: memory.summary ?? "",
      content: memory.content
    });
    setIsEditing(true);
  }

  async function saveMemory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(memoryForm.id ? "正在更新记忆..." : "正在创建记忆...");

    const payload = {
      id: memoryForm.id || undefined,
      title: memoryForm.title,
      type: memoryForm.type,
      scope: memoryForm.scope,
      category_id: memoryForm.category_id || null,
      client_name: memoryForm.client_name || null,
      project_id: memoryForm.project_id || null,
      agent_id: memoryForm.agent_id || null,
      source_type: memoryForm.source_type,
      source_id: memoryForm.source_id || null,
      source_url: memoryForm.source_url || null,
      visibility: memoryForm.visibility,
      importance: Number(memoryForm.importance),
      confidence: Number(memoryForm.confidence),
      summary: memoryForm.summary || null,
      content: memoryForm.content,
      tags: memoryForm.tags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    };

    try {
      const data = await readApiData<any>(
        await fetch("/api/memories", {
          method: memoryForm.id ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );

      const nextMemory = normalizeMemory(data);
      setItems((current) => {
        const exists = current.some((memory) => memory.id === nextMemory.id);
        return exists
          ? current.map((memory) => (memory.id === nextMemory.id ? nextMemory : memory))
          : [nextMemory, ...current];
      });
      setSelectedMemoryId(nextMemory.id);
      setIsEditing(false);
      setMessage("记忆已保存。");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleMemoryAction(memoryId: string, action: "approve" | "reject" | "archive") {
    setMessage(`正在执行${action === "approve" ? "通过" : action === "reject" ? "拒绝" : "归档"}操作...`);
    try {
      await readApiData<any>(
        await fetch("/api/memories", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: memoryId, action })
        })
      );
      await refresh();
      setMessage("状态已更新。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作失败");
    }
  }

  async function saveSource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在保存知识源...");
    try {
      await readApiData<any>(
        await fetch("/api/knowledge-sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sourceForm)
        })
      );
      setSourceForm(initialSourceForm);
      await refresh();
      setMessage("知识源已保存。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "知识源保存失败");
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Memory"
        title="统一记忆库"
        description="把公司知识、客户上下文、项目经验和 SOP 沉淀到同一个地方，方便员工复用。"
        action={<StatusPill text={message} />}
      />

      <section className="grid gap-5 xl:grid-cols-[260px_minmax(420px,1fr)_360px]">
        <aside className="space-y-4">
          <Surface
            title="记忆树"
            subtitle="按公司、客户、项目、员工和 SOP 组织记忆，也可以看待审核项。"
          >
            <TreeButton
              active={selectedTree === "all"}
              label="全部记忆"
              count={items.length}
              onClick={() => setSelectedTree("all")}
            />
            <div className="mt-2 space-y-1">
              {rootTreeItems.map((item) => (
                <div key={item.id}>
                  <TreeButton
                    active={selectedTree === item.id}
                    label={item.label}
                    count={
                      item.id === "pending_review"
                        ? items.filter((memory) => memory.status === "pending_review").length
                        : item.id === "source"
                          ? sources.length
                          : items.filter((memory) => memory.type === item.type).length
                    }
                    onClick={() => setSelectedTree(item.id)}
                  />
                  {categories
                    .filter((category) => category.type === item.type && !category.parentId)
                    .map((category) => (
                      <TreeBranch
                        key={category.id}
                        category={category}
                        categories={categories}
                        count={items.filter((memory) => memory.categoryId === category.id).length}
                        active={selectedTree === `category:${category.id}`}
                        onSelect={(id) => setSelectedTree(`category:${id}`)}
                        items={items}
                      />
                    ))}
                </div>
              ))}
            </div>
          </Surface>

          <Surface title="状态统计">
            <StatGrid
              stats={[
                ["已通过", statusStats.approved ?? 0],
                ["待审核", statusStats.pending_review ?? 0],
                ["草稿", statusStats.draft ?? 0],
                ["已归档", statusStats.archived ?? 0]
              ]}
            />
          </Surface>

          <Surface title="来源统计">
            <div className="space-y-2">
              {["manual", "task", "meeting", "upload", "wps", "notion"].map((source) => (
                <div
                  key={source}
                  className="flex items-center justify-between rounded-[20px] bg-[#fbfcf8] px-3 py-2 text-sm"
                >
                  <span className="text-moss">{sourceTypeLabels[source] ?? source}</span>
                  <span className="font-semibold text-ink">{sourceStats[source] ?? 0}</span>
                </div>
              ))}
            </div>
          </Surface>
        </aside>

        <main className="space-y-4">
          <Surface
            title="记忆检索"
            subtitle={`${visibleItems.length} 条结果，可按类型、状态、客户和项目过滤。`}
          >
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-3 lg:flex-row">
                <label className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 text-moss" size={16} />
                  <input
                    className="w-full rounded-2xl border border-line/70 bg-paper py-2 pl-9 pr-3 text-sm outline-none focus:border-moss"
                    placeholder="搜索标题、摘要、正文或标签"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                  />
                </label>
                <button
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-paper"
                  onClick={startCreate}
                >
                  <Plus size={16} />
                  新建记忆
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <Select
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={["all", "company", "client", "project", "agent", "sop", "review"]}
                  labels={memoryTypeLabels}
                />
                <Select
                  value={statusFilter}
                  onChange={setStatusFilter}
                  options={["all", "draft", "pending_review", "approved", "rejected", "archived"]}
                  labels={statusLabels}
                />
                <Select
                  value={clientFilter}
                  onChange={setClientFilter}
                  options={["all", ...clients]}
                  labels={{
                    ...clientFilterLabels,
                    ...Object.fromEntries(clients.map((client) => [client, client]))
                  }}
                />
                <Select
                  value={projectFilter}
                  onChange={setProjectFilter}
                  options={["all", ...projects.map((project) => project.id)]}
                  labels={{ ...projectFilterBaseLabels, ...projectLabelMap(projects) }}
                />
              </div>
            </div>
          </Surface>

          {items.length === 0 ? (
            <Surface title="还没有记忆">
              <div className="rounded-[24px] border border-dashed border-line/70 bg-[#fbfcf8] p-8 text-center">
                <Database className="mx-auto text-moss" size={30} />
                <h3 className="mt-3 text-lg font-semibold text-ink">先沉淀第一条公司记忆</h3>
                <p className="mt-2 text-sm leading-6 text-moss">
                  把公司定位、客户偏好、交付 SOP 或复盘经验存下来，后续员工就能持续复用。
                </p>
                <button
                  className="mt-4 rounded-full bg-moss px-4 py-2 text-sm font-semibold text-paper"
                  onClick={startCreate}
                >
                  开始录入
                </button>
              </div>
            </Surface>
          ) : (
            <div className="space-y-3">
              {visibleItems.map((memory) => (
                <button
                  key={memory.id}
                  className={`block w-full rounded-[24px] border p-4 text-left transition ${
                    selectedMemory?.id === memory.id
                      ? "border-moss bg-[#fbfcf8]"
                      : "border-line/70 bg-paper hover:bg-[#fbfcf8]"
                  }`}
                  onClick={() => {
                    setSelectedMemoryId(memory.id);
                    setIsEditing(false);
                  }}
                >
                  <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold text-ink">{memory.title}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-moss">
                        {memory.summary || memory.content}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Badge>{statusLabels[memory.status ?? "approved"] ?? (memory.status ?? "approved")}</Badge>
                      <Badge>{memoryTypeLabels[memory.type] ?? memory.type}</Badge>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {memory.tags.slice(0, 4).map((tag) => (
                      <span key={tag} className="rounded-full bg-[#e8efe4] px-2.5 py-1 text-xs font-medium text-moss">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          )}

          <Surface title="待审核队列" subtitle="高风险或敏感记忆会先进入这里。">
            {queue.length === 0 ? (
              <p className="text-sm text-moss">当前没有待审核记忆。</p>
            ) : (
              <div className="space-y-3">
                {queue.map((row) => {
                  const memoryId = row.memory_id ?? row.memoryId;
                  const memory = items.find((item) => item.id === memoryId);
                  return (
                    <div key={row.id} className="rounded-[24px] border border-line/70 bg-[#fbfcf8] p-4">
                      <p className="font-semibold text-ink">{memory?.title ?? "待审核记忆"}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-moss">{row.reason}</p>
                      <div className="mt-3 flex gap-2">
                        {memory && (
                          <ActionButton
                            label="通过"
                            icon={<CheckCircle2 size={14} />}
                            onClick={() => void handleMemoryAction(memory.id, "approve")}
                          />
                        )}
                        {memory && (
                          <ActionButton
                            label="拒绝"
                            icon={<XCircle size={14} />}
                            tone="dark"
                            onClick={() => void handleMemoryAction(memory.id, "reject")}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Surface>
        </main>

        <aside className="space-y-4">
          <Surface title={isEditing ? (memoryForm.id ? "编辑记忆" : "新建记忆") : "记忆详情"}>
            {isEditing ? (
              <MemoryForm
                form={memoryForm}
                setForm={setMemoryForm}
                categories={categories}
                sources={sources}
                projects={projects}
                agents={agents}
                isSaving={isSaving}
                onSubmit={saveMemory}
                onCancel={() => setIsEditing(false)}
              />
            ) : selectedMemory ? (
              <MemoryDetail
                memory={selectedMemory}
                category={categoryById.get(selectedMemory.categoryId ?? "")}
                source={sourceById.get(selectedMemory.sourceId ?? "")}
                project={projects.find((project) => project.id === selectedMemory.projectId)}
                agent={agents.find((agent) => agent.id === selectedMemory.agentId)}
                logs={selectedLogs}
                relations={selectedRelations}
                usageCount={selectedLogs.filter((log) => log.accessType === "retrieve").length}
                onEdit={() => startEdit(selectedMemory)}
                onApprove={() => void handleMemoryAction(selectedMemory.id, "approve")}
                onReject={() => void handleMemoryAction(selectedMemory.id, "reject")}
                onArchive={() => void handleMemoryAction(selectedMemory.id, "archive")}
              />
            ) : (
              <p className="text-sm text-moss">选中一条记忆后，这里会显示详细内容。</p>
            )}
          </Surface>

          <Surface
            title="外部知识源"
            subtitle="先用手动录入和上传文件打通，后续可以继续扩展更多来源。"
          >
            <form className="grid gap-3" onSubmit={saveSource}>
              <input
                className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
                placeholder="知识源名称"
                value={sourceForm.name}
                onChange={(event) => setSourceForm({ ...sourceForm, name: event.target.value })}
                required
              />
              <Select
                value={sourceForm.type}
                onChange={(value) => setSourceForm({ ...sourceForm, type: value })}
                options={["manual", "upload", "wps", "kdocs", "notion", "google_drive", "feishu", "url"]}
                labels={sourceTypeLabels}
              />
              <input
                className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
                placeholder="知识源地址，可留空"
                value={sourceForm.source_url}
                onChange={(event) => setSourceForm({ ...sourceForm, source_url: event.target.value })}
              />
              <button className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper">
                <Upload size={15} />
                保存知识源
              </button>
            </form>
            <div className="mt-4 space-y-2">
              {sources.map((source) => (
                <div key={source.id} className="rounded-[20px] bg-[#fbfcf8] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-ink">{source.name}</span>
                    <Badge>{sourceTypeLabels[source.type] ?? source.type}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-moss">
                    {source.status} · {source.syncMode}
                  </p>
                </div>
              ))}
            </div>
          </Surface>

          <Surface title="使用记录">
            <div className="space-y-2">
              {logs.slice(0, 8).map((log) => (
                <div key={log.id} className="rounded-[20px] bg-[#fbfcf8] p-3 text-xs leading-5 text-moss">
                  <p className="font-semibold text-ink">{log.agentName ?? "员工"} · {log.accessType}</p>
                  <p>{log.memoryTitle ?? log.memoryId}</p>
                  <p>{dateText(log.createdAt)}</p>
                </div>
              ))}
            </div>
          </Surface>
        </aside>
      </section>
    </>
  );
}

function MemoryForm({
  form,
  setForm,
  categories,
  sources,
  projects,
  agents,
  isSaving,
  onSubmit,
  onCancel
}: {
  form: typeof initialMemoryForm;
  setForm: (form: typeof initialMemoryForm) => void;
  categories: MemoryCategory[];
  sources: KnowledgeSource[];
  projects: Project[];
  agents: Agent[];
  isSaving: boolean;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="grid gap-3" onSubmit={onSubmit}>
      <input
        className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
        placeholder="标题"
        value={form.title}
        onChange={(event) => setForm({ ...form, title: event.target.value })}
        required
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={form.type}
          onChange={(value) => setForm({ ...form, type: value })}
          options={["company", "client", "project", "agent", "sop", "review"]}
          labels={memoryTypeLabels}
        />
        <Select
          value={form.scope}
          onChange={(value) => setForm({ ...form, scope: value })}
          options={["global", "client", "project", "agent"]}
          labels={{ global: "全局", client: "客户", project: "项目", agent: "员工" }}
        />
      </div>
      <Select
        value={form.category_id}
        onChange={(value) => setForm({ ...form, category_id: value })}
        options={["", ...categories.map((category) => category.id)]}
        labels={{ "": "未分类", ...Object.fromEntries(categories.map((category) => [category.id, category.name])) }}
      />
      <input
        className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
        placeholder="客户名称，可留空"
        value={form.client_name}
        onChange={(event) => setForm({ ...form, client_name: event.target.value })}
      />
      <Select
        value={form.project_id}
        onChange={(value) => setForm({ ...form, project_id: value })}
        options={["", ...projects.map((project) => project.id)]}
        labels={{ "": "不绑定项目", ...projectLabelMap(projects) }}
      />
      <Select
        value={form.agent_id}
        onChange={(value) => setForm({ ...form, agent_id: value })}
        options={["", ...agents.map((agent) => agent.id)]}
        labels={{ "": "不绑定员工", ...Object.fromEntries(agents.map((agent) => [agent.id, agent.name])) }}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <Select
          value={form.source_type}
          onChange={(value) => setForm({ ...form, source_type: value })}
          options={[
            "manual",
            "upload",
            "task",
            "meeting",
            "file",
            "email",
            "agent_run",
            "wps",
            "kdocs",
            "notion",
            "google_drive"
          ]}
          labels={sourceTypeLabels}
        />
        <Select
          value={form.source_id}
          onChange={(value) => setForm({ ...form, source_id: value })}
          options={["", ...sources.map((source) => source.id)]}
          labels={{ "": "不绑定知识源", ...Object.fromEntries(sources.map((source) => [source.id, source.name])) }}
        />
      </div>
      <input
        className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
        placeholder="来源 URL，可留空"
        value={form.source_url}
        onChange={(event) => setForm({ ...form, source_url: event.target.value })}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <input
          type="number"
          min="1"
          max="5"
          className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
          value={form.importance}
          onChange={(event) => setForm({ ...form, importance: event.target.value })}
        />
        <input
          type="number"
          min="0"
          max="1"
          step="0.1"
          className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
          value={form.confidence}
          onChange={(event) => setForm({ ...form, confidence: event.target.value })}
        />
      </div>
      <input
        className="rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
        placeholder="标签，多个用逗号分隔"
        value={form.tags}
        onChange={(event) => setForm({ ...form, tags: event.target.value })}
      />
      <textarea
        className="min-h-20 rounded-[24px] border border-line/70 bg-paper px-4 py-3 text-sm leading-6 outline-none focus:border-moss"
        placeholder="摘要"
        value={form.summary}
        onChange={(event) => setForm({ ...form, summary: event.target.value })}
      />
      <textarea
        className="min-h-36 rounded-[24px] border border-line/70 bg-paper px-4 py-3 text-sm leading-6 outline-none focus:border-moss"
        placeholder="正文内容"
        value={form.content}
        onChange={(event) => setForm({ ...form, content: event.target.value })}
        required
      />
      <div className="flex flex-wrap gap-2">
        <button
          className="rounded-full bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
          disabled={isSaving}
        >
          {isSaving ? "保存中..." : "保存"}
        </button>
        <button
          type="button"
          className="rounded-full border border-line/70 px-4 py-2 text-sm font-semibold text-moss"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </form>
  );
}

function MemoryDetail({
  memory,
  category,
  source,
  project,
  agent,
  logs,
  relations,
  usageCount,
  onEdit,
  onApprove,
  onReject,
  onArchive
}: {
  memory: Memory;
  category?: MemoryCategory;
  source?: KnowledgeSource;
  project?: Project;
  agent?: Agent;
  logs: MemoryAccessLog[];
  relations: MemoryRelation[];
  usageCount: number;
  onEdit: () => void;
  onApprove: () => void;
  onReject: () => void;
  onArchive: () => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-ink">{memory.title}</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge>{statusLabels[memory.status ?? "approved"] ?? (memory.status ?? "approved")}</Badge>
          <Badge>{memoryTypeLabels[memory.type] ?? memory.type}</Badge>
          <Badge>
            {memory.scope === "global"
              ? "全局"
              : memory.scope === "client"
                ? "客户"
                : memory.scope === "project"
                  ? "项目"
                  : memory.scope === "agent"
                    ? "员工"
                    : memory.scope ?? "全局"}
          </Badge>
        </div>
      </div>
      <DetailRow label="摘要" value={memory.summary || "未填写"} />
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-moss">正文</p>
        <p className="mt-2 whitespace-pre-wrap rounded-[24px] bg-[#fbfcf8] p-3 text-sm leading-6 text-moss">
          {memory.content}
        </p>
      </div>
      <DetailRow label="分类" value={category?.name ?? "未分类"} />
      <DetailRow label="客户" value={memory.clientName ?? "无"} />
      <DetailRow label="项目" value={project?.name ?? memory.projectId ?? "无"} />
      <DetailRow label="关联员工" value={agent?.name ?? "未绑定"} />
      <DetailRow
        label="来源"
        value={`${sourceTypeLabels[memory.sourceType ?? "manual"] ?? (memory.sourceType ?? "manual")}${
          source ? ` · ${source.name}` : ""
        }`}
      />
      {memory.sourceUrl && (
        <a
          className="inline-flex items-center gap-1 text-sm font-semibold text-moss underline"
          href={memory.sourceUrl}
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={14} />
          查看来源
        </a>
      )}
      <div className="grid grid-cols-2 gap-2">
        <Metric
          icon={<Clock3 size={15} />}
          label="最近访问"
          value={memory.lastAccessedAt ? dateText(memory.lastAccessedAt) : "暂无"}
        />
        <Metric icon={<Database size={15} />} label="调用次数" value={String(usageCount)} />
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-moss">标签</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {memory.tags.length ? (
            memory.tags.map((tag) => <Badge key={tag}>#{tag}</Badge>)
          ) : (
            <span className="text-sm text-moss">暂无标签</span>
          )}
        </div>
      </div>
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-moss">
          <Link2 size={14} />
          关联关系
        </p>
        <div className="space-y-2">
          {relations.length ? (
            relations.map((relation) => (
              <p key={relation.id} className="rounded-[20px] bg-[#fbfcf8] p-2 text-xs text-moss">
                {relation.relationType} · {relation.relatedType} · {relation.relatedId}
              </p>
            ))
          ) : (
            <p className="text-sm text-moss">暂无关联记录</p>
          )}
        </div>
      </div>
      <div>
        <p className="mb-2 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-moss">
          <FileText size={14} />
          使用记录
        </p>
        <div className="space-y-2">
          {logs.length ? (
            logs.slice(0, 5).map((log) => (
              <p key={log.id} className="rounded-[20px] bg-[#fbfcf8] p-2 text-xs text-moss">
                {log.accessType} · {log.agentName ?? "system"} · {dateText(log.createdAt)}
              </p>
            ))
          ) : (
            <p className="text-sm text-moss">暂无使用记录</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button className="rounded-full bg-ink px-3 py-2 text-sm font-semibold text-paper" onClick={onEdit}>
          编辑
        </button>
        {memory.status !== "approved" && (
          <ActionButton label="通过" icon={<CheckCircle2 size={14} />} onClick={onApprove} />
        )}
        {memory.status !== "rejected" && (
          <ActionButton label="拒绝" icon={<XCircle size={14} />} tone="dark" onClick={onReject} />
        )}
        {memory.status !== "archived" && (
          <ActionButton label="归档" icon={<Archive size={14} />} tone="dark" onClick={onArchive} />
        )}
      </div>
    </div>
  );
}

function TreeBranch({
  category,
  categories,
  count,
  active,
  onSelect,
  items
}: {
  category: MemoryCategory;
  categories: MemoryCategory[];
  count: number;
  active: boolean;
  onSelect: (id: string) => void;
  items: Memory[];
}) {
  const children = categories.filter((item) => item.parentId === category.id);

  return (
    <div className="ml-3 border-l border-line/70 pl-2">
      <TreeButton active={active} label={category.name} count={count} onClick={() => onSelect(category.id)} compact />
      {children.map((child) => (
        <TreeBranch
          key={child.id}
          category={child}
          categories={categories}
          count={items.filter((memory) => memory.categoryId === child.id).length}
          active={false}
          onSelect={onSelect}
          items={items}
        />
      ))}
    </div>
  );
}

function Surface({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-[28px] border border-line/70 bg-paper p-4">
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-xs leading-5 text-moss">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function TreeButton({
  active,
  label,
  count,
  onClick,
  compact
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
  compact?: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center justify-between gap-2 rounded-[20px] px-3 py-2 text-left text-sm ${
        active ? "bg-moss text-paper" : "text-moss hover:bg-[#fbfcf8]"
      } ${compact ? "py-1.5 text-xs" : ""}`}
      onClick={onClick}
    >
      <span className="truncate">{label}</span>
      <span className={`rounded-full px-2 py-0.5 text-xs ${active ? "bg-paper/20 text-paper" : "bg-[#e8efe4] text-moss"}`}>
        {count}
      </span>
    </button>
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
      className="w-full rounded-2xl border border-line/70 bg-paper px-4 py-3 text-sm outline-none focus:border-moss"
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

function StatGrid({ stats }: { stats: Array<[string, number]> }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {stats.map(([label, value]) => (
        <div key={label} className="rounded-[20px] bg-[#fbfcf8] p-3">
          <p className="text-xs text-moss">{label}</p>
          <p className="mt-1 text-lg font-semibold text-ink">{value}</p>
        </div>
      ))}
    </div>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-[20px] bg-[#fbfcf8] p-3">
      <div className="flex items-center gap-2 text-xs font-semibold text-moss">
        {icon}
        {label}
      </div>
      <p className="mt-1 truncate text-sm font-semibold text-ink">{value}</p>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-moss">{label}</p>
      <p className="mt-1 text-sm leading-6 text-ink">{value}</p>
    </div>
  );
}

function ActionButton({
  onClick,
  icon,
  label,
  tone = "moss"
}: {
  onClick: () => void;
  icon: ReactNode;
  label: string;
  tone?: "moss" | "dark";
}) {
  return (
    <button
      className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-semibold text-paper ${
        tone === "dark" ? "bg-ink" : "bg-moss"
      }`}
      onClick={onClick}
    >
      {icon}
      {label}
    </button>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-[#e8efe4] px-2.5 py-1 text-xs font-semibold text-moss">{children}</span>;
}

function StatusPill({ text }: { text: string }) {
  return (
    <span className="rounded-full border border-line/70 bg-[#fbfcf8] px-4 py-2 text-sm text-moss">
      {text}
    </span>
  );
}

function countBy<T>(items: T[], getter: (item: T) => string) {
  return items.reduce<Record<string, number>>((acc, item) => {
    const key = getter(item);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function projectLabelMap(projects: Project[]) {
  return Object.fromEntries(projects.map((project) => [project.id, project.name]));
}

function dateText(value?: string | null) {
  if (!value) return "暂无";
  return value.slice(0, 10);
}
