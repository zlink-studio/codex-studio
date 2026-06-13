import { isCodexLocalConfigured } from "@/lib/llm/providers/codex-local";
import { isGeminiConfigured } from "@/lib/llm/providers/gemini";
import { isQwenConfigured } from "@/lib/llm/providers/qwen";
import { defaultModelPolicies } from "@/lib/llm/router";
import type { ModelCatalogItem, ModelPolicy, ModelProvider, ModelProviderName, ModelProviderStatus } from "@/lib/types";

type ProviderSeed = Omit<ModelProvider, "status"> & { envNames: string[] };

export const providerSeeds: ProviderSeed[] = [
  provider("openai", "OpenAI API", "OPENAI_API_KEY", true, null, "正式 API Key 模式，适合线上部署和稳定生产调用。"),
  provider("codex_local", "Codex Local OAuth", "CODEX_LOCAL_BASE_URL", true, null, "本机 Codex/OpenClaw OAuth 模式，不使用 OpenAI API Key。"),
  provider("manual_bridge", "ChatGPT Manual Bridge", "LLM_NO_KEY_MODE", true, null, "免 API Key 手动桥接模式：复制 Prompt 到 ChatGPT 网页，再把 JSON 结果粘回工作台。"),
  provider("gemini", "Google Gemini", "GEMINI_API_KEY", true, "https://generativelanguage.googleapis.com", "真实接入：支持 Gemini API Key，也支持 Vertex AI OAuth/ADC。"),
  provider("openrouter", "OpenRouter", "OPENROUTER_API_KEY", false, "https://openrouter.ai/api/v1", "占位：后续统一接入多模型市场。"),
  provider("litellm", "LiteLLM", "LITELLM_API_KEY", false, null, "占位：后续接入企业自建模型网关。"),
  provider("anthropic", "Anthropic Claude", "ANTHROPIC_API_KEY", false, "https://api.anthropic.com", "占位：后续接 Claude。"),
  provider("deepseek", "DeepSeek", "DEEPSEEK_API_KEY", false, "https://api.deepseek.com", "占位：后续接 DeepSeek。"),
  provider("qwen", "Qwen / 通义千问", "QWEN_API_KEY", true, "https://dashscope.aliyuncs.com/compatible-mode/v1", "真实接入：通义千问 DashScope OpenAI 兼容接口。"),
  provider("kimi", "Kimi", "KIMI_API_KEY", false, "https://api.moonshot.cn", "占位：后续接 Kimi。")
];

export const modelCatalogSeeds: ModelCatalogItem[] = [
  catalog("openai", "gpt-4o", "GPT-4o", 128000, 2.5, 10, ["chat", "json", "tools", "vision"], ["strong_reasoning", "review_policy", "coding", "long_context"], true, "OpenAI API Key 模式"),
  catalog("openai", "gpt-4o-mini", "GPT-4o mini", 128000, 0.15, 0.6, ["chat", "json", "tools"], ["low_cost", "creative_content", "business_english"], true, "低成本 OpenAI API 模式"),
  catalog("codex_local", "openai/gpt-5.5", "Codex Local GPT-5.5", 195000, null, null, ["chat", "json", "tools"], ["strong_reasoning", "review_policy", "coding"], true, "通过本机 Codex/OpenClaw OAuth 调用"),
  catalog("manual_bridge", "chatgpt-web-manual", "ChatGPT Web Manual", null, null, null, ["chat", "json"], ["no_api_key", "manual_review"], true, "复制到 ChatGPT 网页运行，再粘贴结果"),
  catalog("gemini", "gemini-3.1-flash-lite", "Gemini 3.1 Flash Lite", 1000000, 0, 0, ["chat", "json", "vision", "long_context"], ["low_cost", "content", "data", "long_context"], true, "Gemini API Free Tier 友好模型"),
  catalog("gemini", "gemini-3.1-flash", "Gemini 3.1 Flash", 1000000, 0, 0, ["chat", "json", "vision", "long_context"], ["creative_content", "business_english", "memory"], true, "Gemini API Flash 模型"),
  catalog("gemini", "gemini-3.1-pro", "Gemini 3.1 Pro", 1000000, null, null, ["chat", "json", "vision", "long_context"], ["strong_reasoning", "review_policy", "long_context"], true, "Gemini Pro 模型，具体额度以 Google AI Studio/Cloud 为准"),
  catalog("openrouter", "openrouter/auto", "OpenRouter Auto", null, null, null, ["chat", "json"], ["future_multi_model"], false, "占位 adapter"),
  catalog("litellm", "router/default", "LiteLLM Default", null, null, null, ["chat", "json"], ["future_gateway"], false, "占位 adapter"),
  catalog("anthropic", "claude-placeholder", "Claude Placeholder", null, null, null, ["chat", "long_context"], ["future_long_context"], false, "占位 adapter"),
  catalog("deepseek", "deepseek-placeholder", "DeepSeek Placeholder", null, null, null, ["chat"], ["future_coding_cost"], false, "占位 adapter"),
  catalog("qwen", "qwen-turbo", "Qwen Turbo", 1000000, 0.3, 0.6, ["chat", "json", "long_context"], ["low_cost", "simple", "data"], true, "通义千问低成本模型，适合批量轻任务"),
  catalog("qwen", "qwen-plus", "Qwen Plus", 1000000, 0.8, 2, ["chat", "json", "long_context"], ["low_cost", "content", "business_english", "data"], true, "通义千问默认均衡模型"),
  catalog("qwen", "qwen-max", "Qwen Max", 1000000, 2.4, 9.6, ["chat", "json", "long_context"], ["strong_reasoning", "review_policy"], true, "通义千问更强模型，适合高风险规划和审核"),
  catalog("kimi", "kimi-placeholder", "Kimi Placeholder", null, null, null, ["chat", "long_context"], ["future_china_long_context"], false, "占位 adapter")
];

export function getDefaultModelProviders(): ModelProvider[] {
  return providerSeeds.map((seed) => ({
    id: seed.name,
    name: seed.name,
    displayName: seed.displayName,
    baseUrl: seed.baseUrl ?? null,
    apiKeyEnv: seed.apiKeyEnv,
    enabled: seed.enabled,
    status: getProviderStatus(seed.name, seed.enabled),
    notes: seed.notes ?? null
  }));
}

export function getProviderStatus(name: ModelProviderName, enabled = true): ModelProviderStatus {
  if (!enabled) return "disabled";
  if (name === "manual_bridge") return process.env.LLM_NO_KEY_MODE === "manual_bridge" ? "configured" : "missing_key";
  if (name === "codex_local") return isCodexLocalConfigured() ? "configured" : "missing_key";
  if (name === "gemini") return isGeminiConfigured() ? "configured" : "missing_key";
  if (name === "qwen") return isQwenConfigured() ? "configured" : "missing_key";

  const seed = providerSeeds.find((item) => item.name === name);
  if (!seed) return "error";
  return seed.envNames.some((envName) => Boolean(process.env[envName])) ? "configured" : "missing_key";
}

export function getDefaultModelPolicies(): ModelPolicy[] {
  return defaultModelPolicies;
}

function provider(name: ModelProviderName, displayName: string, apiKeyEnv: string, enabled: boolean, baseUrl: string | null, notes: string): ProviderSeed {
  return { id: name, name, displayName, apiKeyEnv, envNames: [apiKeyEnv], enabled, baseUrl, notes };
}

function catalog(
  providerName: ModelProviderName,
  model: string,
  displayName: string,
  contextWindow: number | null,
  inputCostPer1m: number | null,
  outputCostPer1m: number | null,
  capabilities: ModelCatalogItem["capabilities"],
  recommendedUse: string[],
  enabled: boolean,
  notes: string
): ModelCatalogItem {
  return {
    id: `${providerName}:${model}`,
    provider: providerName,
    model,
    displayName,
    contextWindow,
    inputCostPer1m,
    outputCostPer1m,
    capabilities,
    recommendedUse,
    enabled,
    notes
  };
}
