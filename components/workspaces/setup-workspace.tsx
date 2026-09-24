"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { CheckCircle2, Copy, Database, Loader2, Moon, PlayCircle, Sparkles, SunMedium, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { readApiData } from "@/lib/client-normalizers";
import { applyTheme } from "@/lib/theme";
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
CREDENTIAL_ENCRYPTION_KEY=
CREDENTIAL_ENCRYPTION_KEY_VERSION=v1
CREDENTIAL_ADMIN_TOKEN=
OBSIDIAN_VAULT_DIR=/你的绝对路径/ObsidianVault
N8N_TOOL_CONNECTION_ID=
N8N_CALLBACK_SECRET=
CONTENT_SCHEDULER_TOKEN=
CONTENT_ADMIN_TOKEN=
CONTENT_TIMEZONE=Asia/Shanghai
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4o-mini
USE_LOCAL_STORE=false`;

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
      setMessage(data.readyForRealUse ? "真实环境已就绪。" : "真实环境还没有完全接通。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "环境检查失败");
    }
  }

  async function bootstrap() {
    setIsBootstrapping(true);
    setMessage("正在初始化真实项目所需数据...");
    try {
      const data = await readApiData<BootstrapResult>(
        await fetch("/api/system/bootstrap", {
          method: "POST",
          headers: { "Content-Type": "application/json" }
        })
      );
      setBootstrapResult(data);
      setMessage("初始化完成。");
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "初始化失败");
    } finally {
      setIsBootstrapping(false);
    }
  }

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    setMessage("已复制到剪贴板。");
  }

  return (
    <>
      <PageHeader
        eyebrow="设置"
        title="系统设置中心"
        description="在这里完成环境检查、真实数据落地和界面主题设置。"
        action={<span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">{message}</span>}
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="界面主题" description="当前视觉采用轻玻璃风格，这里可以切换浅色与深色。">
          <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
            <ThemeToggle />
            <div className="grid gap-3 sm:grid-cols-2">
              <ThemePreset
                title="浅色模式"
                description="更通透，适合演示、汇报和白天操作。"
                icon={<SunMedium size={18} />}
                onClick={() => applyTheme("light")}
              />
              <ThemePreset
                title="深色模式"
                description="更沉稳，适合长时间盯盘和夜间工作。"
                icon={<Moon size={18} />}
                onClick={() => applyTheme("dark")}
              />
            </div>
          </div>
        </Panel>

        <Panel title="上线就绪度" description="只要这三项都绿，系统就已经能进入真实项目运行状态。">
          <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-1">
            <SetupMetric
              label="运行模式"
              value={health?.mode === "database" ? "真实数据库" : health?.mode === "demo" ? "演示模式" : "待配置"}
              ok={health?.mode === "database"}
            />
            <SetupMetric label="数据库连接" value={health?.database.connected ? "已连接" : "未连接"} ok={Boolean(health?.database.connected)} />
            <SetupMetric label="真实可用" value={health?.readyForRealUse ? "已就绪" : "未就绪"} ok={Boolean(health?.readyForRealUse)} />
          </div>
        </Panel>
      </section>

      {health && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Panel title="环境检查" description="先把这些项目全部点亮，再决定是否初始化真实项目数据。">
            <div className="space-y-3">
              {Object.entries({
                NEXT_PUBLIC_SUPABASE_URL: health.checks.supabaseUrl,
                NEXT_PUBLIC_SUPABASE_ANON_KEY: health.checks.supabaseAnonKey,
                SUPABASE_SERVICE_ROLE_KEY: health.checks.supabaseServiceRole,
                DEMO_OWNER_ID: health.checks.demoOwnerId,
                CREDENTIAL_ENCRYPTION_KEY: health.checks.credentialEncryption,
                CREDENTIAL_ADMIN_TOKEN: health.checks.credentialAdmin,
                OBSIDIAN_VAULT_DIR: health.checks.obsidianVault,
                N8N_SOCIAL_CONNECTION: health.checks.n8nSocial,
                N8N_CALLBACK_SECRET: health.checks.n8nCallbackSecret,
                CONTENT_SCHEDULER_TOKEN: health.checks.contentSchedulerToken,
                CONTENT_ADMIN_TOKEN: health.checks.contentAdminToken,
                OPENAI_API_KEY: health.checks.openai,
                CODEX_LOCAL: health.checks.codexLocal,
                MANUAL_BRIDGE: health.checks.manualBridge,
                "public.users owner": Boolean(health.database.ownerReady)
              }).map(([label, ok]) => (
                <div key={label} className="flex items-center justify-between gap-3 rounded-[20px] border border-line/70 bg-paper/40 px-4 py-3">
                  <span className="text-sm font-medium text-ink">{label}</span>
                  <Status ok={ok} />
                </div>
              ))}
            </div>

            {health.missing.length > 0 && (
              <div className="mt-4 rounded-[20px] border border-amber/30 bg-amber/10 p-4 text-sm leading-6 text-moss">
                缺少项：{health.missing.join("、")}
              </div>
            )}

            {health.database.error && (
              <div className="mt-4 rounded-[20px] border border-clay/30 bg-clay/10 p-4 text-sm leading-6 text-moss">
                数据库检查错误：{health.database.error}
              </div>
            )}

            <button
              onClick={bootstrap}
              disabled={isBootstrapping || !health.database.connected || !health.checks.demoOwnerId}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
            >
              {isBootstrapping ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
              初始化真实数据
            </button>

            {bootstrapResult && (
              <div className="mt-4 rounded-[20px] border border-line/70 bg-paper/40 p-4 text-sm leading-6 text-moss">
                {Object.entries(bootstrapResult.result).map(([key, value]) => (
                  <p key={key}>
                    {key}: {String(value)}
                  </p>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="配置步骤" description="按这个顺序做，系统会从待配置进入真实数据库模式。">
            <Step number="1" title="创建 Supabase 项目">
              在 Supabase 创建项目后，进入 SQL Editor，执行 `supabase/schema.sql` 以及迁移脚本。
            </Step>
            <Step number="2" title="创建主账号">
              先在 Supabase Auth 里创建你的账号，再把对应的 `auth.users.id` 写入 `public.users`。
              <CodeBlock text={ownerSql} onCopy={() => void copy(ownerSql)} />
            </Step>
            <Step number="3" title="填写 .env.local">
              把下面这些环境变量写进项目根目录 `.env.local`，不要把真实 key 提交到 GitHub。
              <CodeBlock text={envTemplate} onCopy={() => void copy(envTemplate)} />
            </Step>
            <Step number="4" title="重启本地服务">
              保存环境变量后重启 Next.js，再回到本页点击“初始化真实数据”。
            </Step>
          </Panel>
        </section>
      )}
    </>
  );
}

function ThemePreset({
  title,
  description,
  icon,
  onClick
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className="glass-panel rounded-[22px] p-4 text-left transition hover:bg-paper/70">
      <div className="flex items-center gap-2 text-ink">
        <Sparkles size={16} />
        <span className="inline-flex items-center gap-2 text-sm font-semibold">
          {icon}
          {title}
        </span>
      </div>
      <p className="mt-2 text-sm leading-6 text-moss">{description}</p>
    </button>
  );
}

function SetupMetric({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <article className="glass-panel rounded-[24px] p-4">
      <Database className="text-moss" size={20} />
      <p className="mt-4 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-sm text-moss">{label}</p>
      <div className="mt-3">
        <Status ok={ok} />
      </div>
    </article>
  );
}

function Status({ ok }: { ok: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
        ok ? "bg-[#dff7ea] text-[#0f6b46] dark:bg-[#123828] dark:text-[#8de6bf]" : "bg-[#ffe2e2] text-[#b42318] dark:bg-[#38171c] dark:text-[#ff9d9d]"
      )}
    >
      {ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
      {ok ? "已就绪" : "待完成"}
    </span>
  );
}

function Step({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <div className="mb-5 border-b border-line/70 pb-5 last:mb-0 last:border-0 last:pb-0">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-semibold text-paper">{number}</span>
        <h3 className="font-semibold text-ink">{title}</h3>
      </div>
      <div className="mt-3 text-sm leading-6 text-moss">{children}</div>
    </div>
  );
}

function CodeBlock({ text, onCopy }: { text: string; onCopy: () => void }) {
  return (
    <div className="mt-3 overflow-hidden rounded-[20px] border border-line/70 bg-paper/40">
      <div className="flex justify-end border-b border-line/70 px-3 py-2">
        <button onClick={onCopy} className="inline-flex items-center gap-1 rounded-full border border-line/70 px-2.5 py-1 text-xs font-semibold text-moss">
          <Copy size={13} />
          复制
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-xs leading-6 text-ink">
        <code>{text}</code>
      </pre>
    </div>
  );
}
