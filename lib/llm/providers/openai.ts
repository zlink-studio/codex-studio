import { createOpenAIClient, defaultModel } from "@/lib/openai";
import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

export const openAIProvider: LLMProviderAdapter = {
  name: "openai",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const client = createOpenAIClient();
    const model = input.model || defaultModel;

    if (!client) {
      return {
        provider: "openai",
        model,
        content: "",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs: Date.now() - startedAt,
        status: "failed",
        error: "OPENAI_API_KEY is not configured"
      };
    }

    try {
      const response = await client.chat.completions.create({
        model,
        messages: input.messages.map((message) => ({
          role: message.role === "tool" ? "user" : message.role,
          content: message.content,
          name: message.name
        })),
        temperature: input.temperature ?? 0.2,
        max_tokens: input.maxTokens,
        response_format: input.responseFormat === "json_object" ? { type: "json_object" } : undefined
      });

      const usage = response.usage;
      const inputTokens = usage?.prompt_tokens ?? 0;
      const outputTokens = usage?.completion_tokens ?? 0;

      return {
        provider: "openai",
        model,
        content: response.choices[0]?.message.content ?? "",
        inputTokens,
        outputTokens,
        estimatedCost: estimateOpenAICost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - startedAt,
        status: "succeeded",
        raw: response
      };
    } catch (error) {
      return {
        provider: "openai",
        model,
        content: "",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs: Date.now() - startedAt,
        status: "failed",
        error: error instanceof Error ? error.message : "OpenAI request failed"
      };
    }
  }
};

function estimateOpenAICost(model: string, inputTokens: number, outputTokens: number) {
  const rates = model.includes("mini")
    ? { input: 0.15 / 1_000_000, output: 0.6 / 1_000_000 }
    : { input: 2.5 / 1_000_000, output: 10 / 1_000_000 };
  return inputTokens * rates.input + outputTokens * rates.output;
}
