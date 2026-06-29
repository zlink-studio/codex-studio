"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Rocket, Sparkles, Workflow } from "lucide-react";
import { AgentCard } from "@/components/agent-card";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { CollapsiblePanel } from "@/components/collapsible-panel";
import { agentTemplates, getAgentTemplate } from "@/lib/agent-templates";
import { normalizeAgent, normalizeAgentSkill, normalizeSkill, readApiData } from "@/lib/client-normalizers";
import type { Agent, AgentSkill, Skill } from "@/lib/types";

type AgentFormState = {
  name: string;
  department: string;
  title: string;
  manager_id: string;
  model: string;
  status: string;
  agent_role: string;
  preferred_model_policy: string;
  preferred_provider: string;
  preferred_model: string;
  fallback_provider: string;
  fallback_model: string;
  max_cost_per_run: string;
  temperature: string;
  max_tokens: string;
  skills: string;
  tool_permissions: string;
  prompt: string;
};

const initialForm: AgentFormState = {
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
const providerOptions = ["", "openai", "openrouter", "litellm", "anthropic", "gemini", "deepseek", "qwen", "kimi", "codex_local"];

export function AgentsWorkspace() {
  const [items, setItems] = useState<Agent[]>([]);
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([]);
  const [form, setForm] = useState<AgentFormState>(initialForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState("codex-chief-of-staff");
  const [message, setMessage] = useState("正在加载员工系统...");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setForm(formFromTemplate("codex-chief-of-staff"));
    void loadData();
  }, []);

  async function loadData() {
    try {
      const [agentRows, skillRows, agentSkillRows] = await Promise.all([
        fetch("/api/agents").then((response) => readApiData<any[]>(response)),
        fetch("/api/skills").then((response) => readApiData<any[]>(response)),
        fetch("/api/agent-skills").then((response) => readApiData<any[]>(response))
      ]);
      setItems(agentRows.map(normalizeAgent));
      setSkills(skillRows.map(normalizeSkill));
      setAgentSkills(agentSkillRows.map(normalizeAgentSkill));
      setMessage("员工 roster 已连接本地数据。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "加载员工失败");
    }
  }

  const overview = useMemo(() => {
    const online = items.filter((item) => item.status === "online").length;
    const enabledAssignments = agentSkills.filter((item) => item.enabled).length;
    const installedSkills = skills.filter((item) => item.enabled).length;
    return { online, enabledAssignments, installedSkills };
  }, [agentSkills, items, skills]);

  function applyTemplate(templateId: string) {
    const template = getAgentTemplate(templateId);
    setSelectedTemplateId(template.id);
    setForm(formFromTemplate(template.id));
    setMessage(`已载入模板：${template.name}`);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage("正在保存员工...");

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

      const nextAgent = normalizeAgent(data);
      setItems((current) => [nextAgent, ...current]);

      const recommendedSkillSlugs = recommendedSkillSlugsForTemplate(selectedTemplateId);
      const recommendedSkills = skills.filter((skill) => recommendedSkillSlugs.includes(skill.slug));
      const existingSkillIds = new Set(agentSkills.filter((row) => row.agentId === nextAgent.id).map((row) => row.skillId));

      const createdAssignments = await Promise.all(
        recommendedSkills
          .filter((skill) => !existingSkillIds.has(skill.id))
          .map(async (skill, index) => {
            const created = await readApiData<any>(
              await fetch("/api/agent-skills", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  agent_id: nextAgent.id,
                  skill_id: skill.id,
                  priority: index === 0 ? "primary" : index === 1 ? "secondary" : "optional",
                  enabled: skill.enabled
                })
              })
            );
            return normalizeAgentSkill(created);
          })
      );

      if (createdAssignments.length > 0) {
        setAgentSkills((current) => [...createdAssignments, ...current]);
      }

      setForm(formFromTemplate(selectedTemplateId));
      setMessage(createdAssignments.length > 0 ? "员工已创建，并自动装备了模板技能。" : "员工已创建。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存员工失败");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="员工"
        title="员工系统"
        description="这里是数字员工的组织层。你可以用岗位模板快速装配员工，再给每个员工分配模型、工具权限和技能组合。"
        action={<StatusPill text={message} />}
      />

      <section className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="员工总数" value={String(items.length)} helper="当前已登记员工" />
        <MetricCard label="在线员工" value={String(overview.online)} helper="可以立刻接单" />
        <MetricCard label="已启用技能" value={String(overview.installedSkills)} helper="技能库可用项" />
        <MetricCard label="已分配技能" value={String(overview.enabledAssignments)} helper="员工技能绑定数" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <CollapsiblePanel
            title="岗位模板"
            description="模板会把角色、模型、工具权限、技能组合和提示词一起装好。"
            defaultOpen={false}
          >
            <div className="grid gap-3 md:grid-cols-2">
              {agentTemplates.map((template) => {
                const active = selectedTemplateId === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => applyTemplate(template.id)}
                    className={`rounded-lg border p-4 text-left transition ${active ? "border-moss bg-mint/20" : "border-line bg-paper hover:border-moss/60"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Sparkles size={16} className={active ? "text-moss" : "text-moss/70"} />
                          <h3 className="font-semibold text-ink">{template.name}</h3>
                        </div>
                        <p className="mt-1 text-sm text-moss">{template.description}</p>
                      </div>
                      <span className="rounded-md bg-[#e8efe4] px-2 py-1 text-xs font-semibold text-moss">{template.department}</span>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {template.skills.slice(0, 4).map((skill) => (
                        <span key={skill} className="rounded-md bg-white px-2 py-1 text-xs font-medium text-moss">
                          {skill}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-2 text-sm text-moss">
                      <Workflow size={16} />
                      <span>
                        {template.preferredProvider} / {template.preferredModel}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </CollapsiblePanel>

          <CollapsiblePanel
            title="可参考的外部技能"
            description="这些开源 skill 可以直接作为员工能力的补充来源。"
            defaultOpen={false}
          >
            <div className="space-y-4">
              {agentTemplates.map((template) => (
                <div key={template.id} className="rounded-lg border border-line bg-paper p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h4 className="font-semibold text-ink">{template.name}</h4>
                      <p className="mt-1 text-sm text-moss">{template.outcomes.join(" / ")}</p>
                    </div>
                    <button type="button" onClick={() => applyTemplate(template.id)} className="inline-flex items-center gap-2 rounded-md bg-moss px-3 py-2 text-sm font-semibold text-paper">
                      <Rocket size={16} />
                      套用模板
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {template.githubSkills.map((skill) => (
                      <a key={skill.name} href={skill.url} target="_blank" rel="noreferrer" className="rounded-md bg-[#eef3ff] px-2 py-1 text-xs font-medium text-[#4257a6]" title={skill.note}>
                        {skill.name}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsiblePanel>
        </div>

        <div className="space-y-6">
          <Panel title="当前员工 roster" description="下面这些是系统里真实登记在册的数字员工。">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {items.map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))}
            </div>
          </Panel>

          <CollapsiblePanel
            title="创建员工"
            description="先用模板带出默认值，再按你的业务做微调。"
            defaultOpen={false}
          >
            <form className="grid gap-4 md:grid-cols-2" onSubmit={submit}>
              <Field label="姓名" value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="例如：执行总管" required />
              <Field label="部门" value={form.department} onChange={(value) => setForm({ ...form, department: value })} placeholder="Executive / Marketing" required />
              <Field label="职位" value={form.title} onChange={(value) => setForm({ ...form, title: value })} placeholder="执行总管 Agent" required />
              <Field label="上级 ID" value={form.manager_id} onChange={(value) => setForm({ ...form, manager_id: value })} placeholder="可留空" />
              <Field label="默认模型" value={form.model} onChange={(value) => setForm({ ...form, model: value })} placeholder="gpt-4o-mini" required />
              <Select label="状态" value={form.status} onChange={(value) => setForm({ ...form, status: value })} options={["online", "busy", "idle", "offline"]} />
              <Select label="员工角色" value={form.agent_role} onChange={(value) => setForm({ ...form, agent_role: value })} options={["leader", "worker", "reviewer"]} />
              <Select label="模型策略" value={form.preferred_model_policy} onChange={(value) => setForm({ ...form, preferred_model_policy: value })} options={policyOptions} />
              <Select label="首选 Provider" value={form.preferred_provider} onChange={(value) => setForm({ ...form, preferred_provider: value })} options={providerOptions} />
              <Field label="首选模型" value={form.preferred_model} onChange={(value) => setForm({ ...form, preferred_model: value })} placeholder="为空则使用策略默认值" />
              <Select label="备用 Provider" value={form.fallback_provider} onChange={(value) => setForm({ ...form, fallback_provider: value })} options={providerOptions.filter(Boolean)} />
              <Field label="备用模型" value={form.fallback_model} onChange={(value) => setForm({ ...form, fallback_model: value })} placeholder="gpt-4o-mini" />
              <Field label="单次成本上限 USD" value={form.max_cost_per_run} onChange={(value) => setForm({ ...form, max_cost_per_run: value })} placeholder="0.2" />
              <Field label="Temperature" value={form.temperature} onChange={(value) => setForm({ ...form, temperature: value })} placeholder="0.2" />
              <Field label="Max Tokens" value={form.max_tokens} onChange={(value) => setForm({ ...form, max_tokens: value })} placeholder="1600" />
              <Field label="技能" value={form.skills} onChange={(value) => setForm({ ...form, skills: value })} placeholder="goal_breakdown, review" />

              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">工具权限</span>
                <input className="mt-2 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss" value={form.tool_permissions} onChange={(event) => setForm({ ...form, tool_permissions: event.target.value })} />
              </label>

              <label className="md:col-span-2">
                <span className="text-sm font-medium text-ink">系统提示词</span>
                <textarea
                  className="mt-2 min-h-32 w-full rounded-md border border-line bg-paper px-3 py-2 text-sm outline-none focus:border-moss"
                  value={form.prompt}
                  onChange={(event) => setForm({ ...form, prompt: event.target.value })}
                  placeholder="定义这个员工的职责、边界、输出格式和审批规则。"
                  required
                />
              </label>

              <button className="rounded-md bg-moss px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60 md:w-fit" disabled={isSaving}>
                {isSaving ? "保存中..." : "保存员工"}
              </button>
            </form>
          </CollapsiblePanel>
        </div>
      </section>
    </>
  );
}

function recommendedSkillSlugsForTemplate(templateId: string) {
  if (templateId === "codex-chief-of-staff") return ["openai-docs", "playwright", "gh-address-comments"];
  if (templateId === "executive-operator") return ["goal-breakdown", "review-gate", "memory-capture"];
  if (templateId === "growth-marketer") return ["content-planning", "ads-analysis", "seo-brief"];
  if (templateId === "delivery-operator") return ["implementation-planning", "automation-dispatch", "memory-capture"];
  if (templateId === "finance-reviewer") return ["review-gate", "outbound-sales-drafting"];
  if (templateId === "product-builder") return ["implementation-planning", "data-cleanup", "review-gate"];
  return ["goal-breakdown"];
}

function formFromTemplate(templateId: string): AgentFormState {
  const template = getAgentTemplate(templateId);
  return {
    ...initialForm,
    name: template.defaultName,
    department: template.department,
    title: template.title,
    model: template.preferredModel,
    status: template.status,
    agent_role: template.role,
    preferred_model_policy: template.preferredModelPolicy,
    preferred_provider: template.preferredProvider,
    preferred_model: template.preferredModel,
    fallback_provider: template.fallbackProvider,
    fallback_model: template.fallbackModel,
    max_cost_per_run: String(template.maxCostPerRun),
    temperature: String(template.temperature),
    max_tokens: String(template.maxTokens),
    skills: template.skills.join(", "),
    tool_permissions: template.toolPermissions.join(", "),
    prompt: template.prompt
  };
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="rounded-lg border border-line bg-[#fbfcf8] p-4 shadow-soft">
      <p className="text-sm text-moss">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-xs text-moss">{helper}</p>
    </div>
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
            {option || "使用策略默认值"}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusPill({ text }: { text: string }) {
  return <span className="rounded-md border border-line bg-[#fbfcf8] px-3 py-2 text-sm text-moss">{text}</span>;
}
