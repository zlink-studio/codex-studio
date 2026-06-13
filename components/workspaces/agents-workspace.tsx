"use client";

import { FormEvent, useEffect, useState } from "react";
import { AgentCard } from "@/components/agent-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { normalizeAgent, readApiData } from "@/lib/client-normalizers";
import type { Agent } from "@/lib/types";

const initialForm = {
  name: "",
  department: "Executive",
  title: "",
  manager_id: "",
  model: "gpt-4o-mini",
  status: "idle",
  agent_role: "worker",
  preferred_model_policy: "low_cost",
  preferred_provider: "",
  preferred_model: "",
  fallback_provider: "openai",
  fallback_model: "gpt-4o-mini",
  max_cost_per_run: "",
  temperature: "0.2",
  max_tokens: "1600",
  skills: "task_execution",
  tool_permissions: "openai, supabase",
  prompt: ""
};

const policyOptions = ["strong_reasoning", "review_policy", "creative_content", "low_cost", "coding", "long_context", "business_english"];
const providerOptions = ["", "openai", "openrouter", "litellm", "anthropic", "gemini", "deepseek", "qwen", "kimi"];

export function AgentsWorkspace() {
  const [items, setItems] = useState<Agent[]>([]);
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState("正在加载真实数据...");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((response) => readApiData<any[]>(response))
      .then((data) => {
        setItems(data.map(normalizeAgent));
        setMessage("已连接 Agents API");
      })
      .catch((error: Error) => setMessage(error.message));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("正在保存 Agent...");

    try {
      const payload = {
        ...form,
        manager_id: form.manager_id || null,
        preferred_model_policy: form.preferred_model_policy || null,
        preferred_provider: form.preferred_provider || null,
        preferred_model: form.preferred_model || null,
        fallback_provider: form.fallback_provider || null,
        fallback_model: form.fallback_model || null,
        max_cost_per_run: form.max_cost_per_run ? Number(form.max_cost_per_run) : null,
        temperature: form.temperature ? Number(form.temperature) : null,
        max_tokens: form.max_tokens ? Number(form.max_tokens) : null,
        skills: form.skills.split(",").map((item) => item.trim()).filter(Boolean),
        tool_permissions: form.tool_permissions.split(",").map((item) => item.trim()).filter(Boolean),
        workload: 0,
        success_rate: 0
      };
      const data = await readApiData<any>(
        await fetch("/api/agents", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      );
      setItems((current) => [normalizeAgent(data), ...current]);
      setForm(initialForm);
      setMessage("Agent 已保存");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Agents"
        title="员工中心"
        description="创建和编辑数字员工，配置角色、技能、工具权限、首选模型策略和 fallback 模型。"
        action={<StatusPill text={message} />}
      />

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Panel title="Agent 配置" description="role 决定任务分工，model policy 决定默认路由；Agent 级首选模型会覆盖策略默认值。">
          <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
            <Field label="名称" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="例如：林澈" required />
            <Field label="部门" value={form.department} onChange={(value) => setForm({ ...form, department: value })} placeholder="Executive / Marketing" required />
            <Field label="职位" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="执行经理 Agent" required />
            <Field label="上级 ID" value={form.manager_id} onChange={(value) => setForm({ ...form, manager_id: value })} placeholder="可留空" />
            <Field label="默认模型" value={form.model} onChange={(value) => setForm({ ...form, model: value })} placeholder="gpt-4o-mini" required />
            <Select label="当前状态" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["online", "busy", "idle", "offline"]} />
            <Select label="Agent 角色" value={form.agent_role} onChange={(value) => setForm({ ...form, agent_role: value })} options={["leader", "worker", "reviewer"]} />
            <Select label="模型策略" value={form.preferred_model_policy} onChange={(value) => setForm({ ...form, preferred_model_policy: value })} options={policyOptions} />
            <Select label="首选 Provider" value={form.preferred_provider} onChange={(value) => setForm({ ...form, preferred_provider: value })} options={providerOptions} />
            <Field label="首选模型" value={form.preferred_model} onChange={(value) => setForm({ ...form, preferred_model: value })} placeholder="留空则使用策略模型" />
            <Select label="备用 Provider" value={form.fallback_provider} onChange={(value) => setForm({ ...form, fallback_provider: value })} options={providerOptions.filter(Boolean)} />
            <Field label="备用模型" value={form.fallback_model} onChange={(value) => setForm({ ...form, fallback_model: value })} placeholder="gpt-4o-mini" />
            <Field label="单次成本上限 USD" value={form.max_cost_per_run} onChange={(value) => setForm({ ...form, max_cost_per_run: value })} placeholder="例如：0.2" />
            <Field label="Temperature" value={form.temperature} onChange={(value) => setForm({ ...form, temperature: value })} placeholder="0.2" />
            <Field label="Max Tokens" value={form.max_tokens} onChange={(value) => setForm({ ...form, max_tokens: value })} placeholder="1600" />
            <Field label="技能" value={form.skills} onChange={(value) => setForm({ ...form, skills: value })} placeholder="goal_breakdown, review" />
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-ink">工具权限</span>
              <input className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.tool_permissions} onChange={(event) => setForm({ ...form, tool_permissions: event.target.value })} />
            </label>
            <label className="md:col-span-2">
              <span className="text-sm font-medium text-ink">系统提示词</span>
              <textarea className="mt-2 min-h-32 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.prompt} onChange={(event) => setForm({ ...form, prompt: event.target.value })} placeholder="定义该 Agent 的职责、边界、输出格式和审批规则。" required />
            </label>
            <button className="rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60 md:w-fit" disabled={isSaving}>
              {isSaving ? "保存中..." : "保存 Agent"}
            </button>
          </form>
        </Panel>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          {items.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </section>
      </section>
    </>
  );
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
      <input className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} required={required} />
    </label>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[] }) {
  return (
    <label>
      <span className="text-sm font-medium text-ink">{label}</span>
      <select className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option || "policy-default"} value={option}>
            {option || "使用策略默认"}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{text}</span>;
}
