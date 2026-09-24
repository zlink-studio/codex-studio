"use client";

import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Clock3, ImagePlus, Loader2, Plus, RefreshCw, Send, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { readApiData } from "@/lib/client-normalizers";
import { cn } from "@/lib/utils";

type ContentItem = {
  id: string;
  project_id?: string | null;
  platform: "xiaohongshu";
  account_scope: "owned" | "client";
  format: "image_text" | "video";
  title: string;
  caption: string;
  hashtags: string[];
  asset_urls: string[];
  asset_status: string;
  quality_status: string;
  quality_score?: number | null;
  approval_level: "L1" | "L2";
  approval_status: string;
  status: string;
  scheduled_at?: string | null;
  publication_url?: string | null;
  last_error?: string | null;
  created_at: string;
};

type Metrics = {
  published: number;
  failed: number;
  pendingApproval: number;
  currentDailyStreak: number;
  averageManualMinutesPerDay: number;
  fourWeekDailyTargetMet: boolean;
  interventionTargetMet: boolean;
};

const emptyMetrics: Metrics = {
  published: 0,
  failed: 0,
  pendingApproval: 0,
  currentDailyStreak: 0,
  averageManualMinutesPerDay: 0,
  fourWeekDailyTargetMet: false,
  interventionTargetMet: true
};

export function ContentWorkspace() {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [metrics, setMetrics] = useState<Metrics>(emptyMetrics);
  const [adminToken, setAdminToken] = useState("");
  const [message, setMessage] = useState("正在读取社媒内容产线...");
  const [busyAction, setBusyAction] = useState("");
  const [form, setForm] = useState({
    title: "",
    caption: "",
    hashtags: "",
    projectId: "",
    accountScope: "owned" as "owned" | "client",
    format: "image_text" as "image_text" | "video",
    scheduledAt: toLocalDateTime(new Date(Date.now() + 60 * 60 * 1000))
  });

  const refresh = useCallback(async () => {
    try {
      const [content, metricData] = await Promise.all([
        fetch("/api/content-items", { cache: "no-store" }).then((response) => readApiData<ContentItem[]>(response)),
        fetch("/api/content-items/metrics?days=28", { cache: "no-store" }).then((response) => readApiData<Metrics>(response))
      ]);
      setItems(content);
      setMetrics(metricData);
      setMessage(`内容产线已同步：${content.length} 条内容，近 28 天发布 ${metricData.published} 条。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容产线加载失败。");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!adminToken) return setMessage("请先输入本次会话的 CONTENT_ADMIN_TOKEN。");
    setBusyAction("create");
    try {
      await adminRequest("/api/content-items", adminToken, {
        title: form.title,
        caption: form.caption,
        hashtags: form.hashtags.split(/[,，]/).map((value) => value.trim()).filter(Boolean),
        project_id: form.projectId || undefined,
        account_scope: form.accountScope,
        format: form.format,
        scheduled_at: form.scheduledAt ? new Date(form.scheduledAt).toISOString() : null,
        manual_minutes: 2
      });
      setForm((value) => ({ ...value, title: "", caption: "", hashtags: "" }));
      await refresh();
      setMessage("内容草稿已创建，下一步可派发素材生成。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容创建失败。");
    } finally {
      setBusyAction("");
    }
  }

  async function runAction(item: ContentItem, action: "assets" | "review" | "approve" | "reject" | "publish") {
    if (!adminToken) return setMessage("请先输入本次会话的 CONTENT_ADMIN_TOKEN。");
    setBusyAction(`${item.id}:${action}`);
    try {
      if (action === "assets") {
        await adminRequest(`/api/content-items/${item.id}/assets`, adminToken, {
          provider: item.format === "video" ? "kling" : "jimeng"
        });
      } else if (action === "review") {
        await adminRequest(`/api/content-items/${item.id}/review`, adminToken, { score: 90, notes: "主理人从内容工作台提交质检。" });
      } else if (action === "approve" || action === "reject") {
        await adminRequest(`/api/content-items/${item.id}/approval`, adminToken, {
          decision: action === "approve" ? "approved" : "rejected",
          decision_note: action === "approve" ? "主理人批准发布" : "主理人拒绝发布"
        });
      } else {
        await adminRequest(`/api/content-items/${item.id}/publish`, adminToken, {});
      }
      await refresh();
      setMessage(`${item.title}：${actionLabel[action]}已提交。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "内容操作失败。");
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="SOCIAL CONTENT"
        title="自有社媒内容产线"
        description="文案、素材、质检、审批、排期和发布回写统一进入可审计状态机。"
        action={
          <button type="button" onClick={() => void refresh()} className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-white/55 px-4 py-2 text-sm font-semibold text-ink dark:bg-white/8">
            <RefreshCw size={16} /> 刷新
          </button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="近 28 天发布" value={metrics.published} icon={<Send size={17} />} />
        <Metric label="连续日更" value={`${metrics.currentDailyStreak} 天`} icon={<CalendarClock size={17} />} />
        <Metric label="待 L2 审批" value={metrics.pendingApproval} icon={<ShieldCheck size={17} />} />
        <Metric label="失败待处理" value={metrics.failed} icon={<Clock3 size={17} />} />
        <Metric label="日均人工" value={`${metrics.averageManualMinutesPerDay} 分钟`} icon={<CheckCircle2 size={17} />} />
      </section>

      <Panel title="操作授权" description="令牌只保存在当前页面内存，不会写入浏览器存储。">
        <input
          type="password"
          value={adminToken}
          onChange={(event) => setAdminToken(event.target.value)}
          placeholder="CONTENT_ADMIN_TOKEN"
          className="w-full rounded-2xl border border-line/70 bg-white/45 px-4 py-3 text-sm outline-none dark:bg-white/5"
        />
        <p className="mt-3 text-sm text-moss">{message}</p>
      </Panel>

      <section className="grid gap-5 xl:grid-cols-[380px_minmax(0,1fr)]">
        <Panel title="新建内容" description="先创建文案草稿，再派发即梦/可灵素材流水线。">
          <form onSubmit={createItem} className="space-y-3">
            <input required value={form.title} onChange={(event) => setForm((value) => ({ ...value, title: event.target.value }))} placeholder="标题" className="field" />
            <textarea required value={form.caption} onChange={(event) => setForm((value) => ({ ...value, caption: event.target.value }))} placeholder="正文" className="field min-h-32 resize-y" />
            <input value={form.hashtags} onChange={(event) => setForm((value) => ({ ...value, hashtags: event.target.value }))} placeholder="标签，逗号分隔" className="field" />
            <input value={form.projectId} onChange={(event) => setForm((value) => ({ ...value, projectId: event.target.value }))} placeholder="关联 Project UUID（可选）" className="field" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.accountScope} onChange={(event) => setForm((value) => ({ ...value, accountScope: event.target.value as "owned" | "client" }))} className="field">
                <option value="owned">自有账号 · L1</option>
                <option value="client">客户账号 · L2</option>
              </select>
              <select value={form.format} onChange={(event) => setForm((value) => ({ ...value, format: event.target.value as "image_text" | "video" }))} className="field">
                <option value="image_text">图文</option>
                <option value="video">视频</option>
              </select>
            </div>
            <input type="datetime-local" value={form.scheduledAt} onChange={(event) => setForm((value) => ({ ...value, scheduledAt: event.target.value }))} className="field" />
            <button disabled={busyAction === "create"} className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
              {busyAction === "create" ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} 创建草稿
            </button>
          </form>
        </Panel>

        <div className="space-y-3">
          {items.map((item) => (
            <article key={item.id} className="glass-panel rounded-[28px] p-5">
              <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-ink">{item.title}</h3>
                    <Pill>{statusLabel[item.status] ?? item.status}</Pill>
                    <Pill>{item.approval_level}</Pill>
                    <Pill>{item.account_scope === "owned" ? "自有账号" : "客户账号"}</Pill>
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-moss">{item.caption}</p>
                  <p className="mt-2 text-xs text-moss">
                    排期 {formatDate(item.scheduled_at)} · 素材 {item.asset_urls?.length ?? 0} · 质检 {item.quality_status} · 审批 {item.approval_status}
                  </p>
                  {item.last_error ? <p className="mt-2 text-sm text-red-600">{item.last_error}</p> : null}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {["draft", "asset_failed"].includes(item.status) ? <Action item={item} action="assets" icon={<ImagePlus size={14} />} busy={busyAction} run={runAction} /> : null}
                  {item.status === "review" ? <Action item={item} action="review" icon={<CheckCircle2 size={14} />} busy={busyAction} run={runAction} /> : null}
                  {item.status === "pending_approval" ? (
                    <>
                      <Action item={item} action="approve" icon={<ShieldCheck size={14} />} busy={busyAction} run={runAction} />
                      <Action item={item} action="reject" icon={<Clock3 size={14} />} busy={busyAction} run={runAction} />
                    </>
                  ) : null}
                  {["approved", "scheduled", "publish_queued", "publish_failed"].includes(item.status) ? <Action item={item} action="publish" icon={<Send size={14} />} busy={busyAction} run={runAction} /> : null}
                  {item.publication_url ? <a href={item.publication_url} target="_blank" rel="noreferrer" className="rounded-full border border-line/70 px-3 py-2 text-xs font-semibold text-ink">查看发布</a> : null}
                </div>
              </div>
            </article>
          ))}
          {!items.length ? <div className="glass-panel rounded-[28px] p-10 text-center text-sm text-moss">还没有内容，先创建第一条草稿。</div> : null}
        </div>
      </section>
    </div>
  );
}

function Action({ item, action, icon, busy, run }: { item: ContentItem; action: "assets" | "review" | "approve" | "reject" | "publish"; icon: React.ReactNode; busy: string; run: (item: ContentItem, action: "assets" | "review" | "approve" | "reject" | "publish") => Promise<void> }) {
  const loading = busy === `${item.id}:${action}`;
  return <button type="button" disabled={Boolean(busy)} onClick={() => void run(item, action)} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">{loading ? <Loader2 size={14} className="animate-spin" /> : icon}{actionLabel[action]}</button>;
}

function Metric({ label, value, icon }: { label: string; value: number | string; icon: React.ReactNode }) {
  return <div className="glass-panel rounded-[24px] p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-moss">{label}</p><p className="mt-1 text-2xl font-semibold text-ink">{value}</p></div><span className="rounded-2xl bg-white/55 p-3 text-ink dark:bg-white/8">{icon}</span></div></div>;
}

function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-line/60 bg-white/50 px-2.5 py-1 text-[11px] font-medium text-moss dark:bg-white/5">{children}</span>;
}

async function adminRequest(url: string, token: string, body: Record<string, unknown>) {
  return readApiData(await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify(body) }));
}

function toLocalDateTime(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value?: string | null) {
  return value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value)) : "未设置";
}

const actionLabel = { assets: "生成素材", review: "通过质检", approve: "批准", reject: "拒绝", publish: "立即发布" } as const;
const statusLabel: Record<string, string> = { draft: "草稿", asset_generating: "素材生成中", asset_failed: "素材失败", review: "待质检", rejected: "已拒绝", pending_approval: "待 L2 审批", approved: "已批准", scheduled: "已排期", publish_queued: "待派发", publishing: "发布中", published: "已发布", publish_failed: "发布失败", cancelled: "已取消" };
