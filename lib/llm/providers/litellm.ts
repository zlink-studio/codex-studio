import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

export const liteLLMProvider: LLMProviderAdapter = {
  name: "litellm",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    return {
      provider: "litellm",
      model: input.model,
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: 0,
      status: "failed",
      error: "LiteLLM adapter is a placeholder. Enable it after adding LITELLM_BASE_URL and implementation."
    };
  }
};
