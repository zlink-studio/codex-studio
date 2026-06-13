import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";
import type { ModelProviderName } from "@/lib/types";

export function createPlaceholderProvider(name: ModelProviderName, envName: string): LLMProviderAdapter {
  return {
    name,
    async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
      const configured = Boolean(process.env[envName]);
      return {
        provider: name,
        model: input.model,
        content: "",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs: 0,
        status: "failed",
        error: configured
          ? `${name} adapter is a placeholder in this MVP.`
          : `${envName} is not configured. ${name} adapter is disabled in this MVP.`
      };
    }
  };
}
