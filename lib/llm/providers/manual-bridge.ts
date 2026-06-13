import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

export const manualBridgeProvider: LLMProviderAdapter = {
  name: "manual_bridge",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const prompt = input.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n---\n\n");

    return {
      provider: "manual_bridge",
      model: input.model || "chatgpt-web-manual",
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      error: "MANUAL_BRIDGE_REQUIRED: Copy the generated prompt to ChatGPT web, then paste the JSON result back into the workbench.",
      raw: {
        prompt,
        responseFormat: input.responseFormat,
        metadata: input.metadata
      }
    };
  }
};
