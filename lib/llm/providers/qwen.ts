import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

type QwenChatCompletionResponse = {
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

export function isQwenConfigured() {
  return Boolean(getQwenApiKey());
}

export const qwenProvider: LLMProviderAdapter = {
  name: "qwen",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const model = input.model || defaultQwenModel();
    const apiKey = getQwenApiKey();

    if (!apiKey) {
      return failed(model, startedAt, "QWEN_API_KEY or DASHSCOPE_API_KEY is not configured");
    }

    try {
      const response = await fetch(`${getQwenBaseUrl()}/chat/completions`, {
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
          response_format: input.responseFormat === "json_object" ? { type: "json_object" } : undefined
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Qwen API returned ${response.status}`);
      }

      const data = (await response.json()) as QwenChatCompletionResponse;
      const inputTokens = data.usage?.prompt_tokens ?? 0;
      const outputTokens = data.usage?.completion_tokens ?? 0;

      return {
        provider: "qwen",
        model,
        content: data.choices?.[0]?.message?.content ?? "",
        inputTokens,
        outputTokens,
        estimatedCost: estimateQwenCost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - startedAt,
        status: "succeeded",
        raw: data
      };
    } catch (error) {
      return failed(model, startedAt, error instanceof Error ? error.message : "Qwen request failed");
    }
  }
};

function getQwenApiKey() {
  return process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "";
}

function getQwenBaseUrl() {
  return (process.env.QWEN_BASE_URL || process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1").replace(/\/$/, "");
}

function defaultQwenModel() {
  return process.env.QWEN_MODEL || "qwen-plus";
}

function estimateQwenCost(model: string, inputTokens: number, outputTokens: number) {
  const rates = model.includes("turbo")
    ? { input: 0.3 / 1_000_000, output: 0.6 / 1_000_000 }
    : model.includes("max")
      ? { input: 2.4 / 1_000_000, output: 9.6 / 1_000_000 }
      : { input: 0.8 / 1_000_000, output: 2 / 1_000_000 };

  return inputTokens * rates.input + outputTokens * rates.output;
}

function failed(model: string, startedAt: number, error: string): RunLLMResult {
  return {
    provider: "qwen",
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
