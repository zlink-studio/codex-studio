import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

type DeepSeekChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export function isDeepSeekConfigured() {
  return Boolean(getDeepSeekApiKey());
}

export const deepseekProvider: LLMProviderAdapter = {
  name: "deepseek",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const model = input.model || defaultDeepSeekModel();
    const apiKey = getDeepSeekApiKey();

    if (!apiKey) {
      return failed(model, startedAt, "DEEPSEEK_API_KEY is not configured");
    }

    try {
      const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          messages: input.messages.map((message) => ({
            role: message.role === "tool" ? "user" : message.role,
            content: message.content,
            name: message.name
          })),
          temperature: input.temperature ?? 0.2,
          max_tokens: input.maxTokens,
          response_format: input.responseFormat === "json_object" ? { type: "json_object" } : undefined,
          ...(input.tools?.length ? { tools: input.tools } : {}),
          ...deepSeekThinkingConfig(model)
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `DeepSeek API returned ${response.status}`);
      }

      const data = (await response.json()) as DeepSeekChatCompletionResponse;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      return {
        provider: "deepseek",
        model,
        content: data.choices?.[0]?.message?.content ?? "",
        inputTokens,
        outputTokens,
        estimatedCost: estimateDeepSeekCost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - startedAt,
        status: "succeeded",
        raw: data
      };
    } catch (error) {
      return failed(model, startedAt, error instanceof Error ? error.message : "DeepSeek request failed");
    }
  }
};

function getDeepSeekApiKey() {
  return process.env.DEEPSEEK_API_KEY || "";
}

function getDeepSeekBaseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/$/, "");
}

function defaultDeepSeekModel() {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

function deepSeekThinkingConfig(model: string) {
  const normalized = model.toLowerCase();
  if (normalized.includes("reasoner") || normalized.includes("pro")) {
    return { thinking: { type: "enabled" as const }, reasoning_effort: "high" as const };
  }
  if (normalized.includes("chat") || normalized.includes("flash")) {
    return { thinking: { type: "disabled" as const } };
  }
  return {};
}

function estimateDeepSeekCost(model: string, inputTokens: number, outputTokens: number) {
  const rates = model.toLowerCase().includes("pro")
    ? { input: 0.435 / 1_000_000, output: 0.87 / 1_000_000 }
    : { input: 0.14 / 1_000_000, output: 0.28 / 1_000_000 };

  return inputTokens * rates.input + outputTokens * rates.output;
}

function failed(model: string, startedAt: number, error: string): RunLLMResult {
  return {
    provider: "deepseek",
    model,
    content: "",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    latencyMs: Date.now() - startedAt,
    status: "failed",
    error
  };
}
