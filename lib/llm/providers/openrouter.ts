import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

export const openRouterProvider: LLMProviderAdapter = {
  name: "openrouter",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    return {
      provider: "openrouter",
      model: input.model,
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: 0,
      status: "failed",
      error: "OpenRouter adapter is a placeholder. Enable it after adding OPENROUTER_API_KEY and implementation."
    };
  }
};
