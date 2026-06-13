"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleDollarSign, DatabaseZap, FlaskConical, GitBranch, Loader2, ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { normalizeModelCatalogItem, normalizeModelPolicy, normalizeModelProvider, normalizeModelRun, readApiData } from "@/lib/client-normalizers";
import type { ModelCatalogItem, ModelPolicy, ModelProvider, ModelProviderName, ModelRunSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabKey = "providers" | "catalog" | "policies" | "runs";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "providers", label: "Providers" },
  { key: "catalog", label: "Model Catalog" },
  { key: "policies", label: "Policies" },
  { key: "runs", label: "Runs" }
];

const providerOptions: ModelProviderName[] = [
  "openai",
  "codex_local",
  "manual_bridge",
  "openrouter",
  "litellm",
  "anthropic",
  "gemini",
  "deepseek",
  "qwen",
  "kimi"
];

const initialPolicy = {
  name: "",
  description: "",
  agent_role: "",
  task_type: "",
  risk_level: "",
  primary_provider: "openai",
  primary_model: "gpt-4o-mini",
  fallback_provider: "openai",
  fallback_model: "gpt-4o-mini",
  temperature: "0.2",
  max_tokens: "1600",
  cost_level: "low"
};

export function ModelsWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>("providers");
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [policies, setPolicies] = useState<ModelPolicy[]>([]);
  const [runs, setRuns] = useState<ModelRunSummary[]>([]);
  const [form, setForm] = useState(initialPolicy);
  const [message, setMessage] = useState("正在加载模型配置...");
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    try {
      const [providerRows, catalogRows, policyRows, runRows] = await Promise.all([
        readApiData<any[]>(await fetch("/api/models/providers")),
        readApiData<any[]>(await fetch("/api/models/catalog")),
        readApiData<any[]>(await fetch("/api/models/policies")),
        readApiData<any[]>(await fetch("/api/models/runs"))
      ]);
      setProviders(providerRows.map(normalizeModelProvider));
      setCatalog(catalogRows.map(normalizeModelCatalogItem));
      setPolicies(policyRows.map(normalizeModelPolicy));
      setRuns(runRows.map(normalizeModelRun));
      setMessage("模型中心已加载");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "模型中心加载失败");
    }
  }

  async function testProvider(provider: ModelProvider) {
    setTestingProvider(provider.name);
    setMessage(`正在测试 ${provider.displayName}...`);
    try {
      const body = await readApiData<any>(
        await fetch("/api/models/providers/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider: provider.name, model: testModelFor(provider.name) })
        })
      );
      setMessage(`${provider.displayName}: ${body.message}`);
      await refreshAll();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "连接测试失败");
    } finally {
      setTestingProvider(null);
    }
  }

  async function createPolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("正在保存模型策略...");
    const payload = {
      ...form,
      agent_role: form.agent_role || null,
      task_type: form.task_type || null,
      risk_level: form.risk_level || null,
      temperature: Number(form.temperature || 0.2),
      max_tokens: Number(form.max_tokens || 1600),
      enabled: true
    };

    try {
      const data = await readApiData<any>(
        await fetch("/api/models/policies", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setPolicies((current) => [normalizeModelPolicy(data), ...current]);
      setForm(initialPolicy);
      setMessage("模型策略已保存");
      setActiveTab("policies");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存策略失败");
    }
  }

  const stats = useMemo(
    () => ({
      configured: providers.filter((item) => item.status === "configured").length,
      enabledModels: catalog.filter((item) => item.enabled).length,
      policies: policies.filter((item) => item.enabled).length,
      totalCost: runs.reduce((sum, item) => sum + Number(item.estimatedCost ?? 0), 0)
    }),
    [providers, catalog, policies, runs]
  );

  return (
    <>
      <PageHeader
        eyebrow="Models"
        title="模型管理中心"
        description="统一管理 LLM Provider、模型目录、路由策略和调用记录。当前支持 OpenAI API、本机 Codex/OpenClaw 网关和手动桥接，其他 Provider 先保持占位。"
        action={<span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{message}</span>}
      />

      <section className="grid gap-4 md:grid-cols-4">
        <Metric icon={CheckCircle2} label="已配置 Provider" value={stats.configured} />
        <Metric icon={DatabaseZap} label="可用模型" value={stats.enabledModels} />
        <Metric icon={GitBranch} label="启用策略" value={stats.policies} />
        <Metric icon={CircleDollarSign} label="累计成本" value={`$${stats.totalCost.toFixed(4)}`} />
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn("rounded-md border border-line px-4 py-2 text-sm font-medium text-moss", activeTab === tab.key && "bg-moss text-paper")}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <section className="mt-6">
        {activeTab === "providers" && (
          <Panel title="LLM Providers" description="这里展示连接状态和配置入口，不展示任何 API Key。">
            <div className="grid gap-3 lg:grid-cols-2">
              {providers.map((provider) => (
                <article key={provider.name} className="rounded-lg border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{provider.displayName}</h3>
                      <p className="mt-1 text-sm text-moss">{provider.name}</p>
                    </div>
                    <StatusPill value={provider.status} />
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-moss">
                    <p>Env: {provider.apiKeyEnv}</p>
                    <p>Base URL: {provider.baseUrl ?? "由环境变量或 SDK 决定"}</p>
                    <p>状态: {provider.enabled ? "enabled" : "disabled"}</p>
                    <p>{provider.notes}</p>
                  </div>
                  <button
                    onClick={() => testProvider(provider)}
                    disabled={testingProvider === provider.name}
                    className="mt-4 inline-flex items-center gap-2 rounded-md bg-moss px-3 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                  >
                    {testingProvider === provider.name ? <Loader2 size={16} className="animate-spin" /> : <FlaskConical size={16} />}
                    Test connection
                  </button>
                </article>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === "catalog" && (
          <Panel title="Model Catalog" description="记录模型能力、上下文窗口、成本和推荐用途。">
            <div className="grid gap-3 lg:grid-cols-2">
              {catalog.map((model) => (
                <article key={`${model.provider}-${model.model}`} className="rounded-lg border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{model.displayName}</h3>
                      <p className="mt-1 text-sm text-moss">
                        {model.provider} / {model.model}
                      </p>
                    </div>
                    <StatusPill value={model.enabled ? "configured" : "disabled"} />
                  </div>
                  <div className="mt-4 grid gap-2 text-sm text-moss sm:grid-cols-2">
                    <p>Context: {model.contextWindow?.toLocaleString() ?? "待接入"}</p>
                    <p>Input: {model.inputCostPer1m ? `$${model.inputCostPer1m}/1M` : "-"}</p>
                    <p>Output: {model.outputCostPer1m ? `$${model.outputCostPer1m}/1M` : "-"}</p>
                    <p>用途: {model.recommendedUse.join(", ") || "-"}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {model.capabilities.map((capability) => (
                      <span key={capability} className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-medium text-moss">
                        {capability}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </Panel>
        )}

        {activeTab === "policies" && (
          <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
            <Panel title="新建策略" description="策略会被 Agent 角色、任务类型和风险等级自动匹配。">
              <form className="grid gap-4 md:grid-cols-2" onSubmit={createPolicy}>
                <Field label="策略名" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="例如: finance_review" required />
                <Field label="说明" value={form.description} onChange={(value) => setForm({ ...form, description: value })} placeholder="适用场景" />
                <Select label="Agent Role" value={form.agent_role} onChange={(value) => setForm({ ...form, agent_role: value })} options={["", "leader", "worker", "reviewer"]} />
                <Field label="Task Type" value={form.task_type} onChange={(value) => setForm({ ...form, task_type: value })} placeholder="content / code / contract" />
                <Select label="Risk Level" value={form.risk_level} onChange={(value) => setForm({ ...form, risk_level: value })} options={["", "low", "medium", "high", "critical"]} />
                <Select label="Provider" value={form.primary_provider} onChange={(value) => setForm({ ...form, primary_provider: value })} options={providerOptions} />
                <Field label="Model" value={form.primary_model} onChange={(value) => setForm({ ...form, primary_model: value })} placeholder="gpt-4o-mini / openai/gpt-4o-mini" required />
                <Field label="Fallback Model" value={form.fallback_model} onChange={(value) => setForm({ ...form, fallback_model: value })} placeholder="gpt-4o-mini" />
                <Field label="Temperature" value={form.temperature} onChange={(value) => setForm({ ...form, temperature: value })} placeholder="0.2" />
                <Field label="Max Tokens" value={form.max_tokens} onChange={(value) => setForm({ ...form, max_tokens: value })} placeholder="1600" />
                <Select label="Cost Level" value={form.cost_level} onChange={(value) => setForm({ ...form, cost_level: value })} options={["low", "medium", "high"]} />
                <button className="rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper md:self-end">保存策略</button>
              </form>
            </Panel>

            <Panel title="Routing Policies" description="基础规则：高风险和 leader 使用强模型；内容走创意策略；简单表格走低成本策略。">
              <div className="space-y-3">
                {policies.map((policy) => (
                  <article key={policy.id ?? policy.name} className="rounded-lg border border-line bg-paper p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{policy.name}</h3>
                        <p className="mt-1 text-sm text-moss">{policy.description ?? "No description"}</p>
                      </div>
                      <StatusPill value={policy.enabled ? "configured" : "disabled"} />
                    </div>
                    <div className="mt-4 grid gap-2 text-sm text-moss md:grid-cols-3">
                      <p>Role: {policy.agentRole ?? "any"}</p>
                      <p>Task: {policy.taskType ?? "any"}</p>
                      <p>Risk: {policy.riskLevel ?? "any"}</p>
                      <p>
                        Primary: {policy.primaryProvider}/{policy.primaryModel}
                      </p>
                      <p>
                        Fallback: {policy.fallbackProvider ?? "-"}/{policy.fallbackModel ?? "-"}
                      </p>
                      <p>Cost: {policy.costLevel}</p>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        )}

        {activeTab === "runs" && (
          <Panel title="Model Runs" description="记录每次调用使用的 Provider、模型、策略、token、成本和耗时。">
            {runs.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-paper p-8 text-center text-sm text-moss">
                暂无模型调用记录。使用 Command Center 拆解任务后，这里会出现 run 记录。
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="text-xs uppercase text-moss">
                    <tr>
                      <th className="px-3 py-2">Time</th>
                      <th className="px-3 py-2">Provider</th>
                      <th className="px-3 py-2">Model</th>
                      <th className="px-3 py-2">Policy</th>
                      <th className="px-3 py-2">Tokens</th>
                      <th className="px-3 py-2">Cost</th>
                      <th className="px-3 py-2">Latency</th>
                      <th className="px-3 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr key={run.id} className="border-t border-line">
                        <td className="px-3 py-3 text-moss">{run.createdAt ? new Date(run.createdAt).toLocaleString() : "-"}</td>
                        <td className="px-3 py-3">{run.provider}</td>
                        <td className="px-3 py-3">{run.model}</td>
                        <td className="px-3 py-3">{run.policyName ?? "-"}</td>
                        <td className="px-3 py-3">{(run.inputTokens ?? 0) + (run.outputTokens ?? 0)}</td>
                        <td className="px-3 py-3">${Number(run.estimatedCost ?? 0).toFixed(5)}</td>
                        <td className="px-3 py-3">{run.latencyMs ?? 0}ms</td>
                        <td className="px-3 py-3">
                          <StatusPill value={String(run.status ?? "success")} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}
      </section>

      <div className="mt-6 flex items-start gap-3 rounded-lg border border-line bg-[#fffaf0] p-4 text-sm text-moss">
        <ShieldAlert className="mt-0.5 shrink-0 text-amber" size={18} />
        <p>
          安全边界：OpenAI API Key 只在服务端读取；Codex Local 只连接你本机配置的官方 OAuth 网关；不会提取 ChatGPT 网页 cookie，也不会把 Plus 额度做成云端共享服务。
        </p>
      </div>
    </>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof CheckCircle2; label: string; value: string | number }) {
  return (
    <article className="rounded-lg border border-line bg-[#fbfcf8] p-4">
      <Icon className="text-moss" size={20} />
      <p className="mt-4 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-sm text-moss">{label}</p>
    </article>
  );
}

function StatusPill({ value }: { value: string }) {
  const tone =
    value === "configured" || value === "success" || value === "succeeded"
      ? "bg-mint text-ink"
      : value === "missing_key" || value === "pending"
        ? "bg-[#fff4d8] text-[#7a5a00]"
        : "bg-[#f4e3df] text-[#8a3c2f]";
  return <span className={cn("rounded-md px-2 py-1 text-xs font-semibold", tone)}>{value}</span>;
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  required
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <label>
      <span className="text-sm font-medium text-ink">{label}</span>
      <input
        className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label>
      <span className="text-sm font-medium text-ink">{label}</span>
      <select className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "any"} value={option}>
            {option || "any"}
          </option>
        ))}
      </select>
    </label>
  );
}

function testModelFor(providerName: ModelProviderName) {
  if (providerName === "codex_local") return "openai/gpt-4o-mini";
  if (providerName === "manual_bridge") return "chatgpt-web-manual";
  if (providerName === "openai") return "gpt-4o-mini";
  return undefined;
}
