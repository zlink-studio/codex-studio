"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Database, Loader2, PlayCircle, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { readApiData } from "@/lib/client-normalizers";
import { cn } from "@/lib/utils";

type Health = {
  mode: "database" | "demo" | "setup_required";
  checks: Record<string, boolean>;
  database: { connected: boolean; ownerReady?: boolean; error?: string };
  missing: string[];
  readyForRealUse: boolean;
};

type BootstrapResult = {
  bootstrapped: boolean;
  result: Record<string, number | string>;
};

const envTemplate = `NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
DEMO_OWNER_ID=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
NEXT_PUBLIC_ALLOW_DEMO_DATA=false`;

const ownerSql = `insert into public.users (id, email, display_name, role)
values ('你的 auth.users.id', '你的邮箱', 'Owner', 'owner')
on conflict (id) do update
set email = excluded.email,
    display_name = excluded.display_name,
    role = 'owner';`;

export function SetupWorkspace() {
  const [health, setHealth] = useState<Health | null>(null);
  const [message, setMessage] = useState("正在检查环境...");
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<BootstrapResult | null>(null);

  useEffect(() => {
    void refresh();
  }, []);

  async function refresh() {
    try {
      const data = await readApiData<Health>(await fetch("/api/system/health"));
      setHealth(data);
      setMessage(data.readyForRealUse ? "真实运行环境已就绪" : "真实运行环境尚未就绪");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "环境检查失败");
    }
  }

  async function bootstrap() {
    setIsBootstrapping(true);
    setMessage("正在初始化默认数据...");
    try {
      const data = await readApiData<BootstrapResult>(
        await fetch("/api/system/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        })
      );
      setBootstrapResult(data);
      setMessage("默认数据已初始化");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制到剪贴板");
  }

  return (
    <>
      <PageHeader
        eyebrow="Setup"
        title="真实落地设置中心"
        description="把环境变量、数据库、Owner 用户和默认数据一次性检查清楚。这里不会显示任何密钥内容，只显示是否已配置。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SetupMetric label="运行模式" value={health?.mode ?? "checking"} ok={health?.mode === "database"} />
        <SetupMetric label="数据库连接" value={health?.database.connected ? "connected" : "not ready"} ok={Boolean(health?.database.connected)} />
        <SetupMetric label="真实可用" value={health?.readyForRealUse ? "ready" : "not ready"} ok={Boolean(health?.readyForRealUse)} />
      </section>

      {health && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="环境检查" description="先让这些项目都变成绿色，再点击初始化默认数据。">
            <div className="space-y-3">
              {Object.entries({
                NEXT_PUBLIC_SUPABASE_URL: health.checks.supabaseUrl,
                NEXT_PUBLIC_SUPABASE_ANON_KEY: health.checks.supabaseAnonKey,
                SUPABASE_SERVICE_ROLE_KEY: health.checks.supabaseServiceRole,
                DEMO_OWNER_ID: health.checks.demoOwnerId,
                OPENAI_API_KEY: health.checks.openai,
                "public.users owner": Boolean(health.database.ownerReady)
              }).map(([label, ok]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3 py-2">
                  <span className="text-sm font-medium text-ink">{label}</span>
                  <Status ok={ok} />
                </div>
              ))}
            </div>

            {health.missing.length > 0 && (
              <div className="mt-4 rounded-md border border-amber bg-[#fffaf0] p-3 text-sm leading-6 text-moss">
                缺少：{health.missing.join(", ")}
              </div>
            )}

            {health.database.error && (
              <div className="mt-4 rounded-md border border-[#e4b6aa] bg-[#fff3ef] p-3 text-sm leading-6 text-moss">
                数据库检查错误：{health.database.error}
              </div>
            )}

            <button
              onClick={bootstrap}
              disabled={isBootstrapping || !health.database.connected || !health.checks.demoOwnerId}
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {isBootstrapping ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              初始化默认数据
            </button>

            {bootstrapResult && (
              <div className="mt-4 rounded-md border border-line bg-paper p-3 text-sm leading-6 text-moss">
                {Object.entries(bootstrapResult.result).map(([key, value]) => (
                  <p key={key}>{key}: {String(value)}</p>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="配置步骤" description="照这个顺序做，系统就会从 setup_required 进入 database 模式。">
            <Step number="1" title="创建 Supabase 项目">
              在 Supabase 创建项目后，进入 SQL Editor，执行 `supabase/schema.sql` 和 `supabase/migrations/004_models_center_upgrade.sql`。
            </Step>
            <Step number="2" title="创建 Owner 用户">
              先在 Supabase Auth 里创建你的账号，再把 Auth 用户 id 写入 public.users。
              <CodeBlock text={ownerSql} onCopy={() => copy(ownerSql)} />
            </Step>
            <Step number="3" title="填写 .env.local">
              把下面变量填入项目根目录 `.env.local`，不要把真实 key 提交到 GitHub。
              <CodeBlock text={envTemplate} onCopy={() => copy(envTemplate)} />
            </Step>
            <Step number="4" title="重启本地服务">
              保存环境变量后重启 Next.js，再回到本页点击“初始化默认数据”。
            </Step>
          </Panel>
        </section>
      )}
    </>
  );
}

function SetupMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <article className="rounded-lg border border-line bg-[#fbfcf8] p-4">
      <Database className="text-moss" size={20} />
      <p className="mt-4 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-moss">{label}</p>
      <div className="mt-3">
        <Status ok={ok} />
      </div>
    </article>
  );
}

function Status({ ok }: { ok: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold", ok ? "bg-mint text-ink" : "bg-[#f4e3df] text-[#8a3c2f]")}>
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {ok ? "ready" : "missing"}
    </span>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="mb-5 border-b border-line pb-5 last:mb-0 last:border-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-moss text-sm font-semibold text-paper">{number}</span>
        <h3 className="font-semibold text-ink">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-6 text-moss">{children}</div>
    </div>
  );
}

function CodeBlock({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <div className="mt-3 overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex justify-end border-b border-line px-2 py-2">
        <button onClick={onCopy} className="inline-flex items-center gap-1 rounded-md border border-line px-2 py-1 text-xs font-semibold text-moss">
          <Copy size={13} />
          复制
        </button>
      </div>
      <pre className="overflow-x-auto p-3 text-xs leading-5 text-ink"><code>{text}</code></pre>
    </div>
  );
}
