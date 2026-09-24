"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, GitBranch, Network, Plus, RefreshCw, Save, Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { readApiData } from "@/lib/client-normalizers";
import { cn } from "@/lib/utils";

type VaultNote = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  path: string;
  content: string;
  preview: string;
  links: string[];
  backlinks: string[];
  wordCount: number;
  createdAt: string;
  updatedAt: string;
};

type GraphNode = {
  id: string;
  title: string;
  type: string;
  tags: string[];
  size: number;
};

type GraphEdge = {
  source: string;
  target: string;
};

type VaultData = {
  name: string;
  notes: VaultNote[];
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
  stats: {
    notes: number;
    links: number;
    tags: number;
    orphanNotes: number;
    retrospectiveDrafts: number;
    awaitingSync: number;
  };
};

const emptyVault: VaultData = {
  name: "未配置",
  notes: [],
  graph: { nodes: [], edges: [] },
  stats: { notes: 0, links: 0, tags: 0, orphanNotes: 0, retrospectiveDrafts: 0, awaitingSync: 0 }
};

const typeLabels: Record<string, string> = {
  company: "公司",
  client: "客户",
  project: "项目",
  agent: "员工",
  sop: "SOP",
  review: "复盘",
  source: "资料"
};

const typeColors: Record<string, string> = {
  company: "fill-ink",
  client: "fill-clay",
  project: "fill-mint",
  agent: "fill-amber",
  sop: "fill-emerald-400",
  review: "fill-sky-400",
  source: "fill-moss"
};

export function MemoryWorkspace() {
  const [vault, setVault] = useState<VaultData>(emptyVault);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ title: "", type: "company", tags: "", content: "" });
  const [message, setMessage] = useState("正在加载 Obsidian Vault...");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const refresh = useCallback(async (nextSelectedId?: string) => {
    try {
      const data = await fetch("/api/obsidian-vault", { cache: "no-store" }).then((response) => readApiData<VaultData>(response));
      setVault(data);
      setSelectedId((current) => nextSelectedId || current || data.notes[0]?.id || "");
      setMessage(`已连接本地 Obsidian Vault：${data.stats.notes} 篇笔记，${data.stats.links} 条双链。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Obsidian Vault 加载失败。");
    }
  }, []);

  const selectedNote = vault.notes.find((note) => note.id === selectedId) ?? vault.notes[0] ?? null;

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!selectedNote || editing) return;
    setDraft({
      title: selectedNote.title,
      type: selectedNote.type,
      tags: selectedNote.tags.join(", "),
      content: selectedNote.content
    });
  }, [editing, selectedNote]);

  const filteredNotes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return vault.notes;
    return vault.notes.filter((note) =>
      `${note.title} ${note.path} ${note.preview} ${note.tags.join(" ")}`.toLowerCase().includes(needle)
    );
  }, [query, vault.notes]);

  const graphLayout = useMemo(() => layoutGraph(vault.graph.nodes, vault.graph.edges), [vault.graph]);
  const linkedNotes = useMemo(() => {
    if (!selectedNote) return [];
    const linkedTitles = new Set(selectedNote.links.map((link) => link.toLowerCase()));
    return vault.notes.filter((note) => linkedTitles.has(note.title.toLowerCase()));
  }, [selectedNote, vault.notes]);
  const backlinkNotes = useMemo(() => {
    if (!selectedNote) return [];
    const ids = new Set(selectedNote.backlinks);
    return vault.notes.filter((note) => ids.has(note.id));
  }, [selectedNote, vault.notes]);

  function startNewNote() {
    setEditing(true);
    setSelectedId("");
    setDraft({
      title: "新笔记",
      type: "company",
      tags: "公司大脑",
      content: "用 [[公司中枢]] 这样的双链连接其他笔记。"
    });
  }

  function selectNote(note: VaultNote) {
    setSelectedId(note.id);
    setEditing(false);
    setDraft({
      title: note.title,
      type: note.type,
      tags: note.tags.join(", "),
      content: note.content
    });
  }

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/obsidian-vault", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedId || undefined,
          title: draft.title,
          type: draft.type,
          tags: draft.tags
            .split(",")
            .map((tag) => tag.trim())
            .filter(Boolean),
          content: draft.content
        })
      });
      const note = await readApiData<VaultNote>(response);
      setEditing(false);
      await refresh(note.id);
      setMessage(`已保存到 Vault：${note.path}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  }

  async function syncRetrospectives() {
    setSyncing(true);
    try {
      const result = await fetch("/api/obsidian-vault/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}"
      }).then((response) =>
        readApiData<{ scanned: number; awaitingHumanEdit: number; queued: number; alreadyQueued: number; errors: string[] }>(response)
      );
      await refresh();
      setMessage(
        `复盘同步完成：${result.queued} 篇进入审核，${result.awaitingHumanEdit} 篇仍待人工编辑${result.errors.length ? `，${result.errors.length} 篇失败` : ""}。`
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "复盘同步失败。");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="OBSIDIAN VAULT"
        title="公司大脑知识图谱"
        description="长期记忆现在保存为本地 Markdown 笔记，用双链组织 SOP、项目、员工、客户与复盘。"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void syncRetrospectives()}
              disabled={syncing}
              className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-white/55 px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50 dark:bg-white/8"
            >
              <RefreshCw size={16} className={syncing ? "animate-spin" : ""} />
              同步人工复盘 ({vault.stats.awaitingSync})
            </button>
            <button
              type="button"
              onClick={startNewNote}
              className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-slate-900/10"
            >
              <Plus size={16} />
              新建笔记
            </button>
          </div>
        }
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric label="笔记" value={vault.stats.notes} icon={<BookOpen size={18} />} />
        <Metric label="双链" value={vault.stats.links} icon={<GitBranch size={18} />} />
        <Metric label="标签" value={vault.stats.tags} icon={<Sparkles size={18} />} />
        <Metric label="孤立笔记" value={vault.stats.orphanNotes} icon={<Network size={18} />} />
      </section>

      <section className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="glass-panel-strong rounded-[28px] p-5">
          <div className="flex items-center gap-2 rounded-2xl border border-line/70 bg-white/45 px-3 py-2 dark:bg-white/5">
            <Search size={16} className="text-moss" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索笔记、标签、内容"
              className="w-full bg-transparent text-sm outline-none placeholder:text-moss/70"
            />
          </div>

          <div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto pr-1">
            {filteredNotes.map((note) => (
              <button
                key={note.id}
                type="button"
                onClick={() => selectNote(note)}
                className={cn(
                  "w-full rounded-3xl border p-4 text-left transition",
                  selectedNote?.id === note.id && !editing
                    ? "border-ink/15 bg-white/80 shadow-xl shadow-slate-900/10 dark:bg-white/10"
                    : "border-line/60 bg-white/35 hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-ink">{note.title}</p>
                    <p className="mt-1 text-xs text-moss">{note.path}</p>
                  </div>
                  <span className="rounded-full bg-mint/55 px-2 py-1 text-[11px] font-medium text-ink">
                    {typeLabels[note.type] ?? note.type}
                  </span>
                </div>
                <p className="mt-3 line-clamp-2 text-sm leading-6 text-moss">{note.preview || "空笔记"}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {note.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full bg-white/65 px-2 py-1 text-[11px] text-moss dark:bg-white/8">
                      #{tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <div className="space-y-5">
          <section className="glass-panel-strong rounded-[32px] p-5">
            <div className="mb-4 flex flex-col justify-between gap-3 md:flex-row md:items-center">
              <div>
                <h3 className="text-xl font-semibold text-ink">知识图谱</h3>
                <p className="mt-1 text-sm text-moss">节点来自 Markdown 笔记，连线来自 [[双链]]。</p>
              </div>
              <p className="rounded-full border border-line/70 bg-white/45 px-3 py-1.5 text-xs text-moss dark:bg-white/5">
                Vault: {vault.name}
              </p>
            </div>

            <KnowledgeGraph
              layout={graphLayout}
              edges={vault.graph.edges}
              selectedId={selectedNote?.id ?? ""}
              onSelect={(id) => {
                const note = vault.notes.find((item) => item.id === id);
                if (note) selectNote(note);
              }}
            />
          </section>

          <section className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_360px]">
            <form onSubmit={saveNote} className="glass-panel-strong rounded-[32px] p-5">
              <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-clay">
                    {editing || !selectedNote ? "编辑笔记" : "当前笔记"}
                  </p>
                  <input
                    value={draft.title}
                    onChange={(event) => {
                      setEditing(true);
                      setDraft((value) => ({ ...value, title: event.target.value }));
                    }}
                    className="mt-2 w-full bg-transparent text-3xl font-semibold tracking-tight text-ink outline-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <Save size={16} />
                  {saving ? "保存中" : "保存"}
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-[180px_minmax(0,1fr)]">
                <select
                  value={draft.type}
                  onChange={(event) => {
                    setEditing(true);
                    setDraft((value) => ({ ...value, type: event.target.value }));
                  }}
                  className="rounded-2xl border border-line/70 bg-white/45 px-3 py-2 text-sm outline-none dark:bg-white/5"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <input
                  value={draft.tags}
                  onChange={(event) => {
                    setEditing(true);
                    setDraft((value) => ({ ...value, tags: event.target.value }));
                  }}
                  placeholder="标签，用英文逗号分隔"
                  className="rounded-2xl border border-line/70 bg-white/45 px-3 py-2 text-sm outline-none dark:bg-white/5"
                />
              </div>

              <textarea
                value={draft.content}
                onChange={(event) => {
                  setEditing(true);
                  setDraft((value) => ({ ...value, content: event.target.value }));
                }}
                className="mt-5 min-h-[420px] w-full resize-y rounded-[24px] border border-line/70 bg-white/50 p-4 font-mono text-sm leading-7 text-ink outline-none dark:bg-white/5"
                placeholder="写入 Markdown。使用 [[笔记标题]] 建立双链。"
              />
            </form>

            <aside className="space-y-5">
              <InfoPanel title="双链" empty="这篇笔记还没有指向其他笔记。">
                {linkedNotes.map((note) => (
                  <RelationButton key={note.id} note={note} onClick={() => selectNote(note)} />
                ))}
              </InfoPanel>

              <InfoPanel title="反链" empty="还没有其他笔记引用它。">
                {backlinkNotes.map((note) => (
                  <RelationButton key={note.id} note={note} onClick={() => selectNote(note)} />
                ))}
              </InfoPanel>

              <div className="glass-panel rounded-[28px] p-5">
                <h3 className="font-semibold text-ink">状态</h3>
                <p className="mt-2 text-sm leading-6 text-moss">{message}</p>
                {selectedNote ? (
                  <dl className="mt-4 space-y-2 text-sm">
                    <Row label="字数" value={String(selectedNote.wordCount)} />
                    <Row label="路径" value={selectedNote.path} />
                    <Row label="更新" value={formatDate(selectedNote.updatedAt)} />
                  </dl>
                ) : null}
              </div>
            </aside>
          </section>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <div className="glass-panel rounded-[24px] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-moss">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
        </div>
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/55 text-ink dark:bg-white/8">{icon}</span>
      </div>
    </div>
  );
}

function KnowledgeGraph({
  layout,
  edges,
  selectedId,
  onSelect
}: {
  layout: Array<GraphNode & { x: number; y: number }>;
  edges: GraphEdge[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(layout.map((node) => [node.id, node]));

  return (
    <div className="relative h-[430px] overflow-hidden rounded-[28px] border border-line/70 bg-white/35 dark:bg-white/5">
      <svg viewBox="0 0 900 420" className="h-full w-full">
        <defs>
          <filter id="node-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="7" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {edges.map((edge) => {
          const source = byId.get(edge.source);
          const target = byId.get(edge.target);
          if (!source || !target) return null;
          return (
            <line
              key={`${edge.source}-${edge.target}`}
              x1={source.x}
              y1={source.y}
              x2={target.x}
              y2={target.y}
              className="stroke-line"
              strokeWidth="1.4"
              opacity="0.72"
            />
          );
        })}

        {layout.map((node) => (
          <g
            key={node.id}
            className="cursor-pointer"
            onClick={() => onSelect(node.id)}
            filter={node.id === selectedId ? "url(#node-glow)" : undefined}
          >
            <circle
              cx={node.x}
              cy={node.y}
              r={node.id === selectedId ? node.size + 5 : node.size}
              className={cn(typeColors[node.type] ?? "fill-moss")}
              opacity={node.id === selectedId ? "0.95" : "0.72"}
            />
            <text
              x={node.x}
              y={node.y + node.size + 17}
              textAnchor="middle"
              className="pointer-events-none fill-moss text-[12px] font-medium"
            >
              {node.title.slice(0, 12)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function InfoPanel({ title, empty, children }: { title: string; empty: string; children: React.ReactNode[] }) {
  return (
    <div className="glass-panel rounded-[28px] p-5">
      <h3 className="font-semibold text-ink">{title}</h3>
      <div className="mt-3 space-y-2">
        {children.length ? children : <p className="rounded-2xl border border-dashed border-line/70 p-4 text-sm text-moss">{empty}</p>}
      </div>
    </div>
  );
}

function RelationButton({ note, onClick }: { note: VaultNote; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl border border-line/70 bg-white/40 px-3 py-2 text-left text-sm transition hover:bg-white/70 dark:bg-white/5"
    >
      <span className="font-medium text-ink">{note.title}</span>
      <span className="mt-1 block text-xs text-moss">{note.path}</span>
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-t border-line/60 pt-2">
      <dt className="text-moss">{label}</dt>
      <dd className="max-w-[190px] truncate text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function layoutGraph(nodes: GraphNode[], edges: GraphEdge[]) {
  if (!nodes.length) return [];
  const degree = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degree.set(edge.source, (degree.get(edge.source) ?? 0) + 1);
    degree.set(edge.target, (degree.get(edge.target) ?? 0) + 1);
  }

  const sorted = [...nodes].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const center = sorted[0];
  const rest = sorted.slice(1);
  const radius = Math.max(110, Math.min(170, 85 + nodes.length * 8));

  return [
    { ...center, x: 450, y: 210 },
    ...rest.map((node, index) => {
      const angle = (Math.PI * 2 * index) / Math.max(1, rest.length) - Math.PI / 2;
      const ring = radius + (index % 2) * 58;
      return {
        ...node,
        x: 450 + Math.cos(angle) * ring,
        y: 210 + Math.sin(angle) * ring
      };
    })
  ];
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}
