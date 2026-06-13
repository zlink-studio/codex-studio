import { anthropicProvider } from "@/lib/llm/providers/anthropic";
import { codexLocalProvider, isCodexLocalConfigured } from "@/lib/llm/providers/codex-local";
import { deepseekProvider } from "@/lib/llm/providers/deepseek";
import { geminiProvider } from "@/lib/llm/providers/gemini";
import { kimiProvider } from "@/lib/llm/providers/kimi";
import { liteLLMProvider } from "@/lib/llm/providers/litellm";
import { manualBridgeProvider } from "@/lib/llm/providers/manual-bridge";
import { openAIProvider } from "@/lib/llm/providers/openai";
import { openRouterProvider } from "@/lib/llm/providers/openrouter";
import { qwenProvider } from "@/lib/llm/providers/qwen";
import type { LLMProviderAdapter, ModelRoutingContext, ResolvedModelPolicy, RunLLMInput, RunLLMResult } from "@/lib/llm/types";
import type { ModelPolicy, ModelProviderName } from "@/lib/types";

const providers: Record<ModelProviderName, LLMProviderAdapter> = {
  openai: openAIProvider,
  codex_local: codexLocalProvider,
  manual_bridge: manualBridgeProvider,
  openrouter: openRouterProvider,
  litellm: liteLLMProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  deepseek: deepseekProvider,
  qwen: qwenProvider,
  kimi: kimiProvider
};

export const defaultModelPolicies: ModelPolicy[] = [
  policy("strong_reasoning", "leader", null, null, "openai", "gpt-4o", 0.2, 4000, "high", "复杂推理、高风险规划和老板级决策。"),
  policy("review_policy", "reviewer", null, null, "openai", "gpt-4o", 0.1, 3000, "high", "质量审核、风险复核和审批前检查。"),
  policy("creative_content", null, "content", null, "openai", "gpt-4o-mini", 0.7, 2500, "medium", "内容创意、社媒文案和营销表达。"),
  policy("low_cost", null, "simple", null, "openai", "gpt-4o-mini", 0.2, 1400, "low", "低风险、表格、整理和轻量任务。"),
  policy("coding", null, "code", null, "openai", "gpt-4o", 0.2, 4000, "high", "代码、自动化和工程实现任务。"),
  policy("long_context", null, "long_document", null, "openai", "gpt-4o", 0.15, 6000, "high", "长文档、合同和大上下文分析。"),
  policy("business_english", null, "business_english", null, "openai", "gpt-4o-mini", 0.35, 2200, "medium", "商务英文、跨境邮件和正式表达。"),
  policy("codex_local_default", null, null, null, "codex_local", "openai/gpt-5.5", 0.2, 3000, "low", "本机 Codex/OpenClaw OAuth 网关模式，不使用 OpenAI API Key。"),
  policy("gemini_free", null, "data", null, "gemini", "gemini-3.1-flash-lite", 0.2, 3000, "low", "Gemini API Free Tier 友好策略，适合资料整理、长上下文和低成本任务。"),
  policy("qwen_free", null, "simple", null, "qwen", "qwen-plus", 0.2, 3000, "low", "通义千问免费额度友好策略，适合轻量执行、资料整理和中文任务。"),
  policy("manual_bridge", null, null, null, "manual_bridge", "chatgpt-web-manual", 0.2, 3000, "low", "手动复制到 ChatGPT 网页并粘贴 JSON 结果。")
];

export async function runLLM(input: RunLLMInput): Promise<RunLLMResult> {
  const providerName = input.provider ?? chooseDefaultProvider();
  const adapter = providers[providerName];
  if (!adapter) throw new Error(`Unsupported LLM provider: ${providerName}`);

  const result = await adapter.run({
    ...input,
    provider: providerName,
    model: input.model ?? defaultModelForProvider(providerName),
    messages: input.messages
  });

  if (shouldFallbackToCodexLocal(providerName, result)) {
    return codexLocalProvider.run({
      ...input,
      provider: "codex_local",
      model: input.model ? normalizeCodexModel(input.model) : defaultModelForProvider("codex_local"),
      messages: input.messages
    });
  }

  if (shouldFallbackToManualBridge(providerName, result)) {
    return manualBridgeProvider.run({
      ...input,
      provider: "manual_bridge",
      model: defaultModelForProvider("manual_bridge"),
      messages: input.messages
    });
  }

  return result;
}

export function resolveModelPolicy(context: ModelRoutingContext): ResolvedModelPolicy {
  const taskType = context.taskType?.toLowerCase() ?? null;
  const riskLevel = context.riskLevel ?? null;
  const agentRole = context.agent?.agentRole ?? null;
  const preferred = context.preferredPolicy ?? context.agent?.preferredModelPolicy ?? null;

  let selected =
    (preferred && defaultModelPolicies.find((item) => item.name === preferred)) ||
    (riskLevel === "high" || riskLevel === "critical" ? defaultModelPolicies.find((item) => item.name === "strong_reasoning") : undefined) ||
    (agentRole === "leader" ? defaultModelPolicies.find((item) => item.name === "strong_reasoning") : undefined) ||
    (agentRole === "reviewer" ? defaultModelPolicies.find((item) => item.name === "review_policy") : undefined) ||
    (taskType && ["content", "social"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === "creative_content") : undefined) ||
    (taskType && ["data", "table", "simple"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === "low_cost") : undefined) ||
    (taskType && ["code", "automation"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === "coding") : undefined) ||
    (taskType && ["long_document", "contract"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === "long_context") : undefined) ||
    defaultModelPolicies.find((item) => item.name === "low_cost")!;

  if (process.env.DEFAULT_LLM_PROVIDER === "qwen" && selected.primaryProvider === "openai") {
    selected = {
      ...selected,
      primaryProvider: "qwen",
      primaryModel: defaultQwenModelForPolicy(selected.name),
      fallbackProvider: "manual_bridge",
      fallbackModel: "chatgpt-web-manual"
    };
  }

  if (!process.env.OPENAI_API_KEY && isCodexLocalConfigured() && selected.primaryProvider === "openai") {
    selected = {
      ...selected,
      primaryProvider: "codex_local",
      primaryModel: process.env.CODEX_LOCAL_MODEL || normalizeCodexModel(selected.primaryModel),
      fallbackProvider: "manual_bridge",
      fallbackModel: "chatgpt-web-manual"
    };
  }

  if (context.agent?.preferredProvider || context.agent?.preferredModel || context.agent?.fallbackProvider || context.agent?.fallbackModel) {
    selected = {
      ...selected,
      primaryProvider: context.agent.preferredProvider ?? selected.primaryProvider,
      primaryModel: context.agent.preferredModel ?? selected.primaryModel,
      fallbackProvider: context.agent.fallbackProvider ?? selected.fallbackProvider,
      fallbackModel: context.agent.fallbackModel ?? selected.fallbackModel
    };
  }

  return {
    ...selected,
    needApproval: riskLevel === "high" || riskLevel === "critical"
  };
}

function policy(
  name: string,
  agentRole: ModelPolicy["agentRole"],
  taskType: ModelPolicy["taskType"],
  riskLevel: ModelPolicy["riskLevel"],
  providerName: ModelProviderName,
  model: string,
  temperature: number,
  maxTokens: number,
  costLevel: ModelPolicy["costLevel"],
  description: string
): ModelPolicy {
  return {
    name,
    description,
    agentRole,
    taskType,
    riskLevel,
    primaryProvider: providerName,
    primaryModel: model,
    fallbackProvider: providerName === "manual_bridge" ? "manual_bridge" : "openai",
    fallbackModel: providerName === "manual_bridge" ? "chatgpt-web-manual" : "gpt-4o-mini",
    temperature,
    maxTokens,
    costLevel,
    enabled: true
  };
}

function chooseDefaultProvider(): ModelProviderName {
  if (process.env.DEFAULT_LLM_PROVIDER) return process.env.DEFAULT_LLM_PROVIDER as ModelProviderName;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (isCodexLocalConfigured()) return "codex_local";
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY) return "qwen";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "manual_bridge";
}

function defaultModelForProvider(providerName: ModelProviderName) {
  if (providerName === "codex_local") return process.env.CODEX_LOCAL_MODEL || "openai/gpt-5.5";
  if (providerName === "manual_bridge") return "chatgpt-web-manual";
  if (providerName === "gemini") return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  if (providerName === "qwen") return process.env.QWEN_MODEL || "qwen-plus";
  return "gpt-4o-mini";
}

function shouldFallbackToCodexLocal(providerName: ModelProviderName, result: RunLLMResult) {
  return providerName === "openai" && result.status === "failed" && !process.env.OPENAI_API_KEY && isCodexLocalConfigured();
}

function shouldFallbackToManualBridge(providerName: ModelProviderName, result: RunLLMResult) {
  return providerName === "openai" && result.status === "failed" && !process.env.OPENAI_API_KEY && process.env.LLM_NO_KEY_MODE === "manual_bridge";
}

function normalizeCodexModel(model: string) {
  if (model.startsWith("openai/")) return model;
  if (model.startsWith("codex/")) return model.replace(/^codex\//, "openai/");
  return `openai/${model}`;
}

function defaultQwenModelForPolicy(policyName: string) {
  if (process.env.QWEN_MODEL) return process.env.QWEN_MODEL;
  if (policyName === "strong_reasoning" || policyName === "review_policy" || policyName === "coding" || policyName === "long_context") return "qwen-max";
  if (policyName === "low_cost") return "qwen-turbo";
  return "qwen-plus";
}
