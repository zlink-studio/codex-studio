import { openAIProvider } from "@/lib/llm/providers/openai";
import { openRouterProvider } from "@/lib/llm/providers/openrouter";
import { liteLLMProvider } from "@/lib/llm/providers/litellm";
import type { LLMProviderAdapter, ModelRoutingContext, ResolvedModelPolicy, RunLLMInput, RunLLMResult } from "@/lib/llm/types";
import type { ModelPolicy, ModelProviderName } from "@/lib/types";

const providers: Record<ModelProviderName, LLMProviderAdapter> = {
  openai: openAIProvider,
  openrouter: openRouterProvider,
  litellm: liteLLMProvider
};

export const defaultModelPolicies: ModelPolicy[] = [
  policy("strong_reasoning", "leader", null, null, "gpt-4o", 0.2, 3000, "high"),
  policy("review_policy", "reviewer", null, null, "gpt-4o", 0.1, 2500, "high"),
  policy("creative_content", null, "content", null, "gpt-4o-mini", 0.7, 2500, "medium"),
  policy("creative_social", null, "social", null, "gpt-4o-mini", 0.7, 1800, "medium"),
  policy("low_cost", null, "simple", null, "gpt-4o-mini", 0.2, 1200, "low"),
  policy("data_table", null, "data", null, "gpt-4o-mini", 0.1, 1600, "low"),
  policy("coding_policy", null, "code", null, "gpt-4o", 0.2, 3000, "high"),
  policy("automation_policy", null, "automation", null, "gpt-4o", 0.2, 3000, "high"),
  policy("high_risk_strong", null, null, "high", "gpt-4o", 0.1, 3000, "high")
];

export async function runLLM(input: RunLLMInput): Promise<RunLLMResult> {
  const providerName = input.provider ?? "openai";
  const adapter = providers[providerName];
  if (!adapter) throw new Error(`Unsupported LLM provider: ${providerName}`);

  return adapter.run({
    ...input,
    provider: providerName,
    model: input.model ?? "gpt-4o-mini",
    messages: input.messages
  });
}

export function resolveModelPolicy(context: ModelRoutingContext): ResolvedModelPolicy {
  const taskType = context.taskType?.toLowerCase() ?? null;
  const riskLevel = context.riskLevel ?? null;
  const agentRole = context.agent?.agentRole ?? null;
  const preferred = context.preferredPolicy ?? context.agent?.preferredModelPolicy ?? null;

  let selected =
    (preferred && defaultModelPolicies.find((item) => item.name === preferred)) ||
    (riskLevel === "high" || riskLevel === "critical" ? defaultModelPolicies.find((item) => item.name === "high_risk_strong") : undefined) ||
    (agentRole === "leader" ? defaultModelPolicies.find((item) => item.name === "strong_reasoning") : undefined) ||
    (agentRole === "reviewer" ? defaultModelPolicies.find((item) => item.name === "review_policy") : undefined) ||
    (taskType && ["content", "social"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === (taskType === "social" ? "creative_social" : "creative_content")) : undefined) ||
    (taskType && ["data", "table", "simple"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === (taskType === "data" || taskType === "table" ? "data_table" : "low_cost")) : undefined) ||
    (taskType && ["code", "automation"].includes(taskType) ? defaultModelPolicies.find((item) => item.name === (taskType === "code" ? "coding_policy" : "automation_policy")) : undefined) ||
    defaultModelPolicies.find((item) => item.name === "low_cost")!;

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
  model: string,
  temperature: number,
  maxTokens: number,
  costLevel: ModelPolicy["costLevel"]
): ModelPolicy {
  return {
    name,
    agentRole,
    taskType,
    riskLevel,
    primaryProvider: "openai",
    primaryModel: model,
    fallbackProvider: "openai",
    fallbackModel: "gpt-4o-mini",
    temperature,
    maxTokens,
    costLevel,
    enabled: true
  };
}
