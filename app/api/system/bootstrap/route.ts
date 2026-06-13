import { fail, ok } from "@/lib/api";
import { modelCatalogSeeds, providerSeeds } from "@/lib/llm/catalog";
import { defaultModelPolicies } from "@/lib/llm/router";
import { createSupabaseServerClient } from "@/lib/supabase";

const defaultCategories = [
  ["公司级记忆", "company", null, "公司原则、长期战略和经营背景", 1],
  ["客户级记忆", "client", null, "客户档案、偏好和品牌风格", 2],
  ["项目级记忆", "project", null, "项目目标、里程碑和上下文", 3],
  ["Agent 记忆", "agent", null, "员工偏好、能力和历史表现", 4],
  ["SOP 流程库", "sop", null, "标准流程、审核规则和交付模板", 5],
  ["复盘经验库", "review", null, "复盘、踩坑和改进建议", 6],
  ["外部知识源", "source", null, "上传文件、WPS、Notion 等来源", 7]
] as const;

const defaultAgents = [
  {
    name: "林澈",
    department: "Executive",
    title: "执行经理 Agent",
    model: "gpt-4o",
    prompt: "你是一人公司的执行经理，负责目标拆解、任务编排、风险识别、会议主持和最终结论汇总。",
    tool_permissions: ["openai", "supabase", "n8n", "email"],
    status: "online",
    agent_role: "leader",
    skills: ["goal_breakdown", "task_routing", "risk_review"],
    preferred_model_policy: "strong_reasoning",
    fallback_provider: "openai",
    fallback_model: "gpt-4o-mini",
    workload: 0,
    success_rate: 0
  },
  {
    name: "岑远",
    department: "Marketing",
    title: "增长营销 Agent",
    model: "gpt-4o-mini",
    prompt: "你负责用户洞察、渠道策略、内容日历、广告创意和社媒发布建议。",
    tool_permissions: ["openai", "browser", "n8n"],
    status: "idle",
    agent_role: "worker",
    skills: ["content", "social", "campaigns", "market_research"],
    preferred_model_policy: "creative_content",
    fallback_provider: "openai",
    fallback_model: "gpt-4o-mini",
    workload: 0,
    success_rate: 0
  },
  {
    name: "许栈",
    department: "Operations",
    title: "运营交付 Agent",
    model: "gpt-4o-mini",
    prompt: "你负责 SOP、项目推进、客户交付、自动化流程和复盘沉淀。",
    tool_permissions: ["openai", "supabase", "n8n", "email"],
    status: "idle",
    agent_role: "worker",
    skills: ["delivery", "sop", "automation", "customer_success"],
    preferred_model_policy: "coding",
    fallback_provider: "openai",
    fallback_model: "gpt-4o-mini",
    workload: 0,
    success_rate: 0
  },
  {
    name: "周砚",
    department: "Finance",
    title: "财务风控 Agent",
    model: "gpt-4o",
    prompt: "你负责预算、现金流、报价、合同付款风险和高风险任务复核。",
    tool_permissions: ["openai", "supabase"],
    status: "idle",
    agent_role: "reviewer",
    skills: ["finance", "contract_risk", "approval", "review"],
    preferred_model_policy: "review_policy",
    fallback_provider: "openai",
    fallback_model: "gpt-4o-mini",
    workload: 0,
    success_rate: 0
  }
];

export async function POST() {
  const supabase = createSupabaseServerClient();
  const ownerId = process.env.DEMO_OWNER_ID;

  if (!supabase) return fail("Supabase is not configured. Fill NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY first.", 503);
  if (!ownerId) return fail("DEMO_OWNER_ID is required.", 503);
  const db = supabase;

  const { data: owner, error: ownerError } = await db.from("users").select("id,email").eq("id", ownerId).maybeSingle();
  if (ownerError) return fail(ownerError.message, 500);
  if (!owner) return fail("DEMO_OWNER_ID does not exist in public.users. Create the owner user first.", 409);

  const result = {
    ownerId,
    agents: 0,
    memoryCategories: 0,
    knowledgeSources: 0,
    modelProviders: 0,
    modelCatalog: 0,
    modelPolicies: 0
  };

  for (const [name, type, parentId, description, sortOrder] of defaultCategories) {
    const exists = await existsByName("memory_categories", ownerId, name);
    if (!exists) {
      const { error } = await db.from("memory_categories").insert({
        owner_id: ownerId,
        name,
        type,
        parent_id: parentId,
        description,
        sort_order: sortOrder
      });
      if (error) return fail(error.message, 500);
      result.memoryCategories += 1;
    }
  }

  for (const source of [
    { name: "手动录入", type: "manual", status: "active", metadata: { default: true } },
    { name: "上传文件", type: "upload", status: "active", metadata: { enabled: true } }
  ]) {
    const exists = await existsByName("knowledge_sources", ownerId, source.name);
    if (!exists) {
      const { error } = await db.from("knowledge_sources").insert({
        owner_id: ownerId,
        name: source.name,
        type: source.type,
        sync_mode: "manual",
        status: source.status,
        metadata: source.metadata
      });
      if (error) return fail(error.message, 500);
      result.knowledgeSources += 1;
    }
  }

  for (const agent of defaultAgents) {
    const exists = await existsByName("agents", ownerId, agent.name);
    if (!exists) {
      const { error } = await db.from("agents").insert({ owner_id: ownerId, ...agent });
      if (error) return fail(error.message, 500);
      result.agents += 1;
    }
  }

  for (const provider of providerSeeds) {
    const exists = await existsGlobalBy("model_providers", "name", provider.name);
    if (!exists) {
      const { error } = await db.from("model_providers").insert({
        name: provider.name,
        display_name: provider.displayName,
        base_url: provider.baseUrl,
        api_key_env: provider.apiKeyEnv,
        enabled: provider.enabled,
        status: provider.enabled ? "missing_key" : "disabled",
        notes: provider.notes
      });
      if (error) return fail(error.message, 500);
      result.modelProviders += 1;
    }
  }

  for (const model of modelCatalogSeeds) {
    const { data } = await db
      .from("model_catalog")
      .select("id")
      .is("owner_id", null)
      .eq("provider", model.provider)
      .eq("model", model.model)
      .maybeSingle();
    if (!data) {
      const { error } = await db.from("model_catalog").insert({
        provider: model.provider,
        model: model.model,
        display_name: model.displayName,
        context_window: model.contextWindow,
        input_cost_per_1m: model.inputCostPer1m,
        output_cost_per_1m: model.outputCostPer1m,
        capabilities: model.capabilities,
        recommended_use: model.recommendedUse,
        enabled: model.enabled,
        notes: model.notes
      });
      if (error) return fail(error.message, 500);
      result.modelCatalog += 1;
    }
  }

  for (const policy of defaultModelPolicies) {
    const exists = await existsGlobalBy("model_policies", "name", policy.name);
    if (!exists) {
      const { error } = await db.from("model_policies").insert({
        name: policy.name,
        description: policy.description,
        agent_role: policy.agentRole,
        task_type: policy.taskType,
        risk_level: policy.riskLevel,
        primary_provider: policy.primaryProvider,
        primary_model: policy.primaryModel,
        fallback_provider: policy.fallbackProvider,
        fallback_model: policy.fallbackModel,
        temperature: policy.temperature,
        max_tokens: policy.maxTokens,
        cost_level: policy.costLevel,
        enabled: policy.enabled
      });
      if (error) return fail(error.message, 500);
      result.modelPolicies += 1;
    }
  }

  return ok({ bootstrapped: true, result });

  async function existsByName(table: string, currentOwnerId: string, name: string) {
    const { data, error } = await db.from(table).select("id").eq("owner_id", currentOwnerId).eq("name", name).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  async function existsGlobalBy(table: string, column: string, value: string) {
    const { data, error } = await db.from(table).select("id").is("owner_id", null).eq(column, value).maybeSingle();
    if (error) throw new Error(error.message);
    return Boolean(data);
  }
}
