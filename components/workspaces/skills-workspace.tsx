"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, Play, RefreshCcw, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { StatusBadge } from "@/components/status-badge";
import {
  normalizeAgent,
  normalizeAgentSkill,
  normalizeSkill,
  normalizeSkillReview,
  normalizeSkillRun,
  readApiData
} from "@/lib/client-normalizers";
import type { Agent, AgentSkill, Skill, SkillReview, SkillRun } from "@/lib/types";

type TabKey = "library" | "matrix" | "runs" | "review";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "library", label: "技能库" },
  { key: "matrix", label: "员工技能矩阵" },
  { key: "runs", label: "技能试跑记录" },
  { key: "review", label: "技能审查" }
];

const initialSkillForm = {
  name: "",
  slug: "",
  category: "management",
  description: "",
  instructions: "",
  source: "github",
  source_url: "",
  version: "0.1.0",
  license: "Internal",
  skill_type: "knowledge",
  risk_level: "low",
  approval_required: false
};

const categoryLabels: Record<string, string> = {
  management: "管理",
  memory: "记忆",
  content: "内容",
  seo: "SEO",
  sales: "销售",
  ads: "广告",
  data: "数据",
  code: "代码",
  automation: "自动化",
  review: "审查"
};

const skillTypeLabels: Record<string, string> = {
  knowledge: "知识型",
  action: "动作型"
};

const riskLabels: Record<string, string> = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "关键风险"
};

const sourceLabels: Record<string, string> = {
  custom: "自建",
  github: "GitHub",
  imported: "导入"
};

const recommendedSkills = [
  {
    name: "Playwright QA Skill",
    slug: "playwright-qa-skill",
    category: "code",
    description: "适合产品落地员工，负责页面验收、回归检查和交互验证。",
    instructions: "用于页面验收、冒烟测试和关键路径复核。",
    source: "github",
    source_url: "https://github.com/openai/skills/tree/main/skills/.curated/playwright",
    version: "import-draft",
    license: "See source repository",
    skill_type: "knowledge",
    risk_level: "medium",
    approval_required: false
  },
  {
    name: "Research Documentation Skill",
    slug: "research-documentation-skill",
    category: "management",
    description: "适合主控和增长员工，用来整理研究、背景资料和决策摘要。",
    instructions: "用于研究资料收集、归纳和决策支持。",
    source: "github",
    source_url: "https://github.com/openai/skills/tree/main/skills/.curated/notion-research-documentation",
    version: "import-draft",
    license: "See source repository",
    skill_type: "knowledge",
    risk_level: "low",
    approval_required: false
  },
  {
    name: "Approval Review Skill",
    slug: "approval-review-skill",
    category: "review",
    description: "适合法务和财务审查员工，聚焦合同、承诺、付款和对外发布类高风险事项。",
    instructions: "用于审批前风险检查，需要经过主理人审查后启用。",
    source: "github",
    source_url: "https://github.com/example/high-risk-review-skill",
    version: "import-draft",
    license: "license_review_required",
    skill_type: "knowledge",
    risk_level: "high",
    approval_required: true
  }
] as const;

export function SkillsWorkspace() {
  const [activeTab, setActiveTab] = useState<TabKey>("library");
  const [skills, setSkills] = useState<Skill[]>([]);
  const [agentSkills, setAgentSkills] = useState<AgentSkill[]>([]);
  const [skillRuns, setSkillRuns] = useState<SkillRun[]>([]);
  const [skillReviews, setSkillReviews] = useState<SkillReview[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [message, setMessage] = useState("正在加载技能系统...");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [form, setForm] = useState(initialSkillForm);

  useEffect(() => {
    void loadData();
  }, []);

  const overview = useMemo(() => {
    const enabledSkills = skills.filter((skill) => skill.enabled).length;
    const reviewRequired = skills.filter((skill) => skill.approvalRequired).length;
    const assignedSkills = agentSkills.filter((row) => row.enabled).length;
    const pendingReviews = skillReviews.filter((review) => review.reviewStatus === "pending").length;
    return { enabledSkills, reviewRequired, assignedSkills, pendingReviews };
  }, [agentSkills, skillReviews, skills]);

  async function loadData() {
    try {
      setMessage("正在加载技能系统...");
      const [skillRows, agentSkillRows, runRows, reviewRows, agentRows] = await Promise.all([
        fetch("/api/skills").then((response) => readApiData<any[]>(response)),
        fetch("/api/agent-skills").then((response) => readApiData<any[]>(response)),
        fetch("/api/skill-runs").then((response) => readApiData<any[]>(response)),
        fetch("/api/skill-reviews").then((response) => readApiData<any[]>(response)),
        fetch("/api/agents").then((response) => readApiData<any[]>(response))
      ]);

      setSkills(skillRows.map(normalizeSkill));
      setAgentSkills(agentSkillRows.map(normalizeAgentSkill));
      setSkillRuns(runRows.map(normalizeSkillRun));
      setSkillReviews(reviewRows.map(normalizeSkillReview));
      setAgents(agentRows.map(normalizeAgent));
      setMessage("技能系统已连接本地数据。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "技能系统加载失败");
    }
  }

  async function createSkill(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusyKey("create-skill");
    setMessage("正在登记新技能...");

    try {
      await readApiData<any>(
        await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form)
        })
      );

      setForm(initialSkillForm);
      await loadData();
      setMessage("新技能已入库。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登记技能失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function importRecommendedSkill(preset: (typeof recommendedSkills)[number]) {
    setBusyKey(`preset-${preset.slug}`);
    setMessage(`正在导入 ${preset.name}...`);
    try {
      await readApiData<any>(
        await fetch("/api/skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(preset)
        })
      );
      await loadData();
      setMessage(`${preset.name} 已导入技能库。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "导入推荐技能失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function toggleSkill(skill: Skill) {
    setBusyKey(skill.id);
    try {
      const updated = await readApiData<any>(
        await fetch("/api/skills", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: skill.id, enabled: !skill.enabled })
        })
      );
      setSkills((current) => current.map((item) => (item.id === skill.id ? normalizeSkill(updated) : item)));
      setMessage(skill.enabled ? `已停用 ${skill.name}` : `已启用 ${skill.name}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新技能状态失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function assignSkill(agentId: string, skillId: string, priority: "primary" | "secondary" | "optional" = "optional") {
    setBusyKey(`${agentId}-${skillId}`);
    try {
      const created = await readApiData<any>(
        await fetch("/api/agent-skills", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent_id: agentId,
            skill_id: skillId,
            priority,
            enabled: true
          })
        })
      );
      const next = normalizeAgentSkill(created);
      setAgentSkills((current) => {
        const exists = current.findIndex((item) => item.id === next.id);
        if (exists >= 0) {
          const clone = [...current];
          clone[exists] = next;
          return clone;
        }
        return [next, ...current];
      });
      setMessage("技能已分配给员工。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "分配技能失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function updateAgentSkill(row: AgentSkill, patch: Record<string, unknown>, successMessage: string) {
    setBusyKey(row.id);
    try {
      const updated = await readApiData<any>(
        await fetch("/api/agent-skills", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: row.id, ...patch })
        })
      );
      const next = normalizeAgentSkill(updated);
      setAgentSkills((current) => current.map((item) => (item.id === row.id ? next : item)));
      setMessage(successMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "更新员工技能失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function runSkill(skill: Skill) {
    setBusyKey(`run-${skill.id}`);
    setMessage(`正在试跑 ${skill.name}...`);
    try {
      await readApiData<any>(
        await fetch("/api/skill-runs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            skill_id: skill.id,
            agent_id: agents[0]?.id ?? null,
            status: skill.approvalRequired ? "pending_approval" : "success",
            input: { mode: "smoke-test" },
            output: skill.approvalRequired ? null : { result: "ok" },
            latency_ms: 420
          })
        })
      );
      await loadData();
      setMessage(`${skill.name} 试跑完成。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "技能试跑失败");
    } finally {
      setBusyKey(null);
    }
  }

  async function decideReview(review: SkillReview, reviewStatus: "approved" | "rejected") {
    setBusyKey(review.id);
    try {
      const updated = await readApiData<any>(
        await fetch("/api/skill-reviews", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: review.id,
            review_status: reviewStatus,
            risk_notes:
              reviewStatus === "approved" ? "主理人已批准上线。" : "主理人已驳回，暂不允许启用。",
            reviewed_by: "owner"
          })
        })
      );
      const next = normalizeSkillReview(updated);
      setSkillReviews((current) => current.map((item) => (item.id === review.id ? next : item)));
      await loadData();
      setMessage(reviewStatus === "approved" ? "技能已批准上线。" : "技能已驳回。");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "处理审查失败");
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="技能"
        title="技能系统"
        description="管理内部和外部导入技能，分配给员工，跟踪执行表现，并在上线前完成风险审查。"
        action={<span className="rounded-full border border-line/70 bg-paper/55 px-4 py-2 text-sm text-moss backdrop-blur-xl">{message}</span>}
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="已启用技能" value={String(overview.enabledSkills)} helper="技能库可用项" />
        <MetricCard label="需要审查" value={String(overview.reviewRequired)} helper="高风险或外部技能" />
        <MetricCard label="已分配技能" value={String(overview.assignedSkills)} helper="员工已装配能力" />
        <MetricCard label="待审查项" value={String(overview.pendingReviews)} helper="需要主理人处理" />
      </section>

      <div className="mt-6 flex gap-2 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-full border border-line/70 px-4 py-2 text-sm font-medium ${
              activeTab === tab.key ? "bg-ink text-paper" : "bg-paper/40 text-moss"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "library" && (
        <section className="mt-6 grid gap-6 xl:grid-cols-[1.04fr_0.96fr]">
          <Panel title="推荐技能包" description="先装这些基础能力，能更快把员工系统跑起来。">
            <div className="space-y-4">
              {recommendedSkills.map((skill) => (
                <article key={skill.slug} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-ink">{skill.name}</h3>
                      <p className="mt-1 text-sm leading-6 text-moss">{skill.description}</p>
                    </div>
                    <Chip tone={skill.approval_required ? "warn" : "ok"}>
                      {skill.approval_required ? "需审查" : "可直接试跑"}
                    </Chip>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Chip>{categoryLabels[skill.category]}</Chip>
                    <Chip>{riskLabels[skill.risk_level]}</Chip>
                    <Chip>{skillTypeLabels[skill.skill_type]}</Chip>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void importRecommendedSkill(skill)}
                      disabled={busyKey === `preset-${skill.slug}`}
                      className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                    >
                      <Sparkles size={16} />
                      {busyKey === `preset-${skill.slug}` ? "导入中..." : "导入"}
                    </button>
                    <a
                      href={skill.source_url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/45 px-4 py-2 text-sm font-semibold text-moss"
                    >
                      <Link2 size={16} />
                      查看来源
                    </a>
                  </div>
                </article>
              ))}
            </div>
          </Panel>

          <Panel title="新增技能" description="把你自定义的流程、规则或外部 skill 登记进系统。">
            <form className="grid gap-4 md:grid-cols-2" onSubmit={createSkill}>
              <Field label="名称">
                <Input value={form.name} onChange={(value) => setForm({ ...form, name: value })} placeholder="例如：合同风险检查" />
              </Field>
              <Field label="Slug">
                <Input value={form.slug} onChange={(value) => setForm({ ...form, slug: value })} placeholder="contract-risk-review" />
              </Field>
              <Field label="分类">
                <Select
                  value={form.category}
                  onChange={(value) => setForm({ ...form, category: value })}
                  options={Object.keys(categoryLabels)}
                  labels={categoryLabels}
                />
              </Field>
              <Field label="类型">
                <Select
                  value={form.skill_type}
                  onChange={(value) => setForm({ ...form, skill_type: value })}
                  options={["knowledge", "action"]}
                  labels={skillTypeLabels}
                />
              </Field>
              <Field label="来源">
                <Select
                  value={form.source}
                  onChange={(value) => setForm({ ...form, source: value })}
                  options={["github", "custom", "imported"]}
                  labels={sourceLabels}
                />
              </Field>
              <Field label="风险等级">
                <Select
                  value={form.risk_level}
                  onChange={(value) => setForm({ ...form, risk_level: value })}
                  options={["low", "medium", "high", "critical"]}
                  labels={riskLabels}
                />
              </Field>
              <Field label="版本">
                <Input value={form.version} onChange={(value) => setForm({ ...form, version: value })} placeholder="0.1.0" />
              </Field>
              <Field label="许可证">
                <Input value={form.license} onChange={(value) => setForm({ ...form, license: value })} placeholder="MIT / Internal" />
              </Field>
              <div className="md:col-span-2">
                <Field label="来源地址">
                  <Input value={form.source_url} onChange={(value) => setForm({ ...form, source_url: value })} placeholder="https://github.com/..." />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="描述">
                  <textarea
                    className="min-h-24 w-full rounded-2xl border border-line/70 bg-paper/70 px-3 py-3 text-sm outline-none focus:border-moss"
                    value={form.description}
                    onChange={(event) => setForm({ ...form, description: event.target.value })}
                    placeholder="说明这个技能解决什么问题。"
                  />
                </Field>
              </div>
              <div className="md:col-span-2">
                <Field label="执行说明">
                  <textarea
                    className="min-h-32 w-full rounded-2xl border border-line/70 bg-paper/70 px-3 py-3 text-sm outline-none focus:border-moss"
                    value={form.instructions}
                    onChange={(event) => setForm({ ...form, instructions: event.target.value })}
                    placeholder="写清楚技能要怎么用、对谁开放、风险点是什么。"
                  />
                </Field>
              </div>
              <label className="md:col-span-2 flex items-center gap-3 rounded-[20px] border border-line/70 bg-paper/45 px-4 py-3 text-sm text-moss">
                <input
                  type="checkbox"
                  checked={form.approval_required}
                  onChange={(event) => setForm({ ...form, approval_required: event.target.checked })}
                />
                这个技能需要经过主理人审查后才能正式启用
              </label>
              <button
                className="rounded-full bg-ink px-4 py-2.5 text-sm font-semibold text-paper disabled:opacity-60 md:col-span-2"
                disabled={busyKey === "create-skill"}
              >
                {busyKey === "create-skill" ? "保存中..." : "保存技能"}
              </button>
            </form>
          </Panel>

          <Panel className="xl:col-span-2" title="技能库" description="第一版技能系统：可管理、可分配、可试跑、可审查。">
            <div className="grid gap-4 lg:grid-cols-2">
              {skills.length > 0 ? (
                skills.map((skill) => {
                  const review = skillReviews.find((item) => item.skillId === skill.id);
                  return (
                    <article key={skill.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="font-semibold text-ink">{skill.name}</h3>
                          <p className="mt-1 text-sm leading-6 text-moss">{skill.description}</p>
                        </div>
                        <StatusBadge value={skill.enabled ? "approved" : review?.reviewStatus ?? "pending"} />
                      </div>

                      <div className="mt-3 flex flex-wrap gap-2">
                        <Chip>{categoryLabels[skill.category]}</Chip>
                        <Chip>{riskLabels[skill.riskLevel]}</Chip>
                        <Chip>{skillTypeLabels[skill.skillType]}</Chip>
                        <Chip tone={skill.approvalLevel === "L2" || skill.approvalLevel === "L3" ? "warn" : "muted"}>
                          {skill.approvalLevel ?? "L0"}
                        </Chip>
                        <Chip>{sourceLabels[skill.source]}</Chip>
                      </div>

                      <div className="mt-3 text-sm text-moss">
                        <p>版本：{skill.version ?? "-"}</p>
                        <p>许可证：{skill.license ?? "-"}</p>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleSkill(skill)}
                          disabled={busyKey === skill.id}
                          className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/45 px-4 py-2 text-sm font-semibold text-moss disabled:opacity-60"
                        >
                          <RefreshCcw size={16} />
                          {skill.enabled ? "停用" : "启用"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void runSkill(skill)}
                          disabled={busyKey === `run-${skill.id}`}
                          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper disabled:opacity-60"
                        >
                          <Play size={16} />
                          {busyKey === `run-${skill.id}` ? "试跑中..." : "试跑"}
                        </button>
                        {skill.sourceUrl && (
                          <a
                            href={skill.sourceUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/45 px-4 py-2 text-sm font-semibold text-moss"
                          >
                            <Link2 size={16} />
                            来源
                          </a>
                        )}
                      </div>
                    </article>
                  );
                })
              ) : (
                <EmptyState title="还没有技能" body="先导入推荐 skill，或者登记你自己的业务能力包。" />
              )}
            </div>
          </Panel>
        </section>
      )}

      {activeTab === "matrix" && (
        <Panel className="mt-6" title="员工技能矩阵" description="把不同技能装到不同员工身上，形成固定分工。">
          <div className="space-y-4">
            {agents.map((agent) => {
              const rows = agentSkills.filter((row) => row.agentId === agent.id);
              const unassignedSkills = skills.filter((skill) => !rows.some((row) => row.skillId === skill.id));
              return (
                <article key={agent.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-semibold text-ink">{agent.name}</h3>
                      <p className="mt-1 text-sm text-moss">{agent.title}</p>
                    </div>
                    <StatusBadge value={agent.status} />
                  </div>

                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-[20px] border border-line/70 bg-paper/55 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">已绑定技能</p>
                      <div className="mt-3 space-y-2">
                        {rows.length > 0 ? (
                          rows.map((row) => {
                            const skill = skills.find((item) => item.id === row.skillId);
                            return (
                              <div key={row.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-paper px-3 py-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <Chip tone={row.enabled ? "ok" : "muted"}>{skill?.name ?? row.skillId}</Chip>
                                  <Chip>{row.priority}</Chip>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    className="rounded-full border border-line/70 px-3 py-1.5 text-xs text-moss"
                                    onClick={() =>
                                      void updateAgentSkill(
                                        row,
                                        {
                                          priority:
                                            row.priority === "primary"
                                              ? "secondary"
                                              : row.priority === "secondary"
                                                ? "optional"
                                                : "primary"
                                        },
                                        "已切换技能优先级。"
                                      )
                                    }
                                  >
                                    切换优先级
                                  </button>
                                  <button
                                    className="rounded-full border border-line/70 px-3 py-1.5 text-xs text-moss"
                                    onClick={() =>
                                      void updateAgentSkill(
                                        row,
                                        { enabled: !row.enabled },
                                        row.enabled ? "已停用员工技能。" : "已启用员工技能。"
                                      )
                                    }
                                  >
                                    {row.enabled ? "停用" : "启用"}
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        ) : (
                          <p className="text-sm text-moss">这个员工还没有绑定技能。</p>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[20px] border border-line/70 bg-paper/55 p-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-moss">快速补技能</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {unassignedSkills.length > 0 ? (
                          unassignedSkills.map((skill) => {
                            const key = `${agent.id}-${skill.id}`;
                            return (
                              <button
                                key={skill.id}
                                type="button"
                                onClick={() => void assignSkill(agent.id, skill.id)}
                                disabled={busyKey === key}
                                className="rounded-full border border-line/70 px-3 py-1.5 text-xs font-medium text-moss hover:border-moss disabled:opacity-60"
                              >
                                {busyKey === key ? "处理中..." : `+ ${skill.name}`}
                              </button>
                            );
                          })
                        ) : (
                          <p className="text-sm text-moss">这个员工已经装满当前技能库。</p>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </Panel>
      )}

      {activeTab === "runs" && (
        <Panel className="mt-6" title="技能试跑记录" description="这里追踪每次 skill 被调用后的结果，用来判断它是否真的能上岗。">
          <div className="space-y-3">
            {skillRuns.length > 0 ? (
              skillRuns.map((run) => {
                const skill = skills.find((item) => item.id === run.skillId);
                const agent = agents.find((item) => item.id === run.agentId);
                return (
                  <article key={run.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{skill?.name ?? run.skillId}</h3>
                        <p className="mt-1 text-sm text-moss">
                          {agent?.name ?? "未分配员工"} / task {run.taskId ?? "-"}
                        </p>
                      </div>
                      <StatusBadge
                        value={
                          run.status === "pending_approval"
                            ? "pending"
                            : run.status === "error"
                              ? "blocked"
                              : "done"
                        }
                      />
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2 text-xs">
                      <Chip>{run.createdAt}</Chip>
                      <Chip>{run.latencyMs ? `${run.latencyMs} ms` : "latency -"}</Chip>
                      {run.modelRunId && <Chip>{run.modelRunId}</Chip>}
                    </div>

                    {run.output && (
                      <p className="mt-3 text-sm text-moss">输出：{JSON.stringify(run.output)}</p>
                    )}
                    {run.error && <p className="mt-3 text-sm text-[#7a2f1f]">异常：{run.error}</p>}
                  </article>
                );
              })
            ) : (
              <EmptyState title="还没有技能运行记录" body="先去技能库里给某个 skill 试跑一次，这里就会开始积累数据。" />
            )}
          </div>
        </Panel>
      )}

      {activeTab === "review" && (
        <Panel className="mt-6" title="技能审查队列" description="高风险技能和外部导入技能，都应该在这里过一遍再决定是否启用。">
          <div className="space-y-3">
            {skillReviews.length > 0 ? (
              skillReviews.map((review) => {
                const skill = skills.find((item) => item.id === review.skillId);
                return (
                  <article key={review.id} className="rounded-[24px] border border-line/70 bg-paper/45 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-ink">{skill?.name ?? review.skillId}</h3>
                        <p className="mt-1 text-sm text-moss">
                          {skill?.source ? sourceLabels[skill.source] : "未知来源"} / {skill?.license ?? "待确认许可证"}
                        </p>
                      </div>
                      <StatusBadge value={review.reviewStatus} />
                    </div>

                    <div className="mt-3 flex items-start gap-2 rounded-[20px] bg-paper/65 p-3 text-sm text-moss">
                      <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                      <p>{review.riskNotes ?? "暂无风险说明。"}</p>
                    </div>

                    {review.reviewStatus === "pending" && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button
                          className="inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper"
                          onClick={() => void decideReview(review, "approved")}
                        >
                          <CheckCircle2 size={16} />
                          批准上线
                        </button>
                        <button
                          className="inline-flex items-center gap-2 rounded-full border border-line/70 bg-paper/45 px-4 py-2 text-sm font-semibold text-moss"
                          onClick={() => void decideReview(review, "rejected")}
                        >
                          <XCircle size={16} />
                          驳回
                        </button>
                      </div>
                    )}
                  </article>
                );
              })
            ) : (
              <EmptyState title="审查队列已清空" body="当前没有待审查的 skill，可以继续导入新技能或安排员工试跑。" />
            )}
          </div>
        </Panel>
      )}
    </>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="glass-panel rounded-[26px] p-5">
      <p className="text-sm text-moss">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-xs text-moss">{helper}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      className="w-full rounded-2xl border border-line/70 bg-paper/70 px-3 py-3 text-sm outline-none focus:border-moss"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
    />
  );
}

function Chip({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "ok" | "warn" | "muted" }) {
  const className =
    tone === "ok"
      ? "bg-[#e8efe4] text-moss"
      : tone === "warn"
        ? "bg-[#fff1d6] text-[#7a4814]"
        : tone === "muted"
          ? "bg-[#ecefe8] text-[#657065]"
          : "bg-[#eef3ff] text-[#4257a6]";

  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${className}`}>{children}</span>;
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
      className="w-full rounded-2xl border border-line/70 bg-paper/70 px-3 py-3 text-sm outline-none focus:border-moss"
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

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-[24px] border border-dashed border-line/70 bg-paper/35 p-8 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#eef3ff] text-[#4257a6]">
        <ShieldCheck size={18} />
      </div>
      <p className="mt-3 font-semibold text-ink">{title}</p>
      <p className="mt-2 text-sm leading-6 text-moss">{body}</p>
    </div>
  );
}
