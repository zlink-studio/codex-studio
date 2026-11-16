import Anthropic from "@anthropic-ai/sdk";
import {
  CLAUDE_FALLBACK_BETA,
  estimateClaudeCost,
  getAnthropicClient,
  getClaudeModel,
  isAnthropicConfigured,
  shouldUseClaudeBridge
} from "@/lib/llm/anthropic-client";
import { bridgeComplete } from "@/lib/llm/claude-bridge";
import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

const JSON_INSTRUCTION = "只输出一个合法的 JSON 对象，不要输出 Markdown 代码块或任何额外文字。";

export const anthropicProvider: LLMProviderAdapter = {
  name: "anthropic",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const model = getClaudeModel(input.model?.startsWith("claude-") ? input.model : null);

    if (!isAnthropicConfigured()) {
      return failed(model, startedAt, "Neither the Claude bridge nor ANTHROPIC_API_KEY is configured.");
    }

    // The router speaks OpenAI-style messages; Claude takes system text separately
    // and only user/assistant turns. Tool messages are folded into user turns.
    const systemParts = input.messages.filter((message) => message.role === "system").map((message) => message.content);
    if (input.responseFormat === "json_object") systemParts.push(JSON_INSTRUCTION);

    const messages: Anthropic.Beta.BetaMessageParam[] = input.messages
      .filter((message) => message.role !== "system")
      .map((message) => ({
        role: message.role === "assistant" ? "assistant" : "user",
        content: message.content
      }));
    if (messages.length === 0 || messages[0].role !== "user") {
      messages.unshift({ role: "user", content: "请开始。" });
    }

    if (shouldUseClaudeBridge()) {
      try {
        const conversation = messages
          .map((message) => `${message.role === "assistant" ? "ASSISTANT" : "USER"}:\n${String(message.content)}`)
          .join("\n\n---\n\n");
        const result = await bridgeComplete({
          system: systemParts.join("\n\n") || undefined,
          prompt: messages.length === 1 ? String(messages[0].content) : conversation,
          model
        });
        return {
          provider: "anthropic",
          model: result.model,
          content: result.text.trim(),
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          // Billed to the owner's Claude subscription, not per token.
          estimatedCost: 0,
          latencyMs: Date.now() - startedAt,
          status: "succeeded",
          raw: { via: "claude_bridge", list_price_usd: result.costUsd }
        };
      } catch (error) {
        return failed(model, startedAt, error instanceof Error ? error.message : "Claude bridge request failed");
      }
    }

    try {
      // Streaming avoids HTTP timeouts on long outputs; finalMessage() collects the result.
      const stream = getAnthropicClient().beta.messages.stream({
        model,
        max_tokens: Math.max(input.maxTokens ?? 0, 16000),
        system: systemParts.join("\n\n") || undefined,
        messages,
        output_config: { effort: "medium" },
        betas: [CLAUDE_FALLBACK_BETA],
        fallbacks: "default"
      });
      const message = await stream.finalMessage();

      if (message.stop_reason === "refusal") {
        return failed(model, startedAt, "Claude declined this request (refusal).", message);
      }

      const content = message.content
        .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === "text")
        .map((block) => block.text)
        .join("")
        .trim();
      const inputTokens = message.usage.input_tokens ?? 0;
      const outputTokens = message.usage.output_tokens ?? 0;

      return {
        provider: "anthropic",
        model: message.model ?? model,
        content,
        inputTokens,
        outputTokens,
        estimatedCost: estimateClaudeCost(model, inputTokens, outputTokens),
        latencyMs: Date.now() - startedAt,
        status: "succeeded",
        raw: { id: message.id, stop_reason: message.stop_reason }
      };
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return failed(model, startedAt, `Claude API error ${error.status ?? ""}: ${error.message}`);
      }
      return failed(model, startedAt, error instanceof Error ? error.message : "Claude request failed");
    }
  }
};

function failed(model: string, startedAt: number, error: string, raw?: unknown): RunLLMResult {
  return {
    provider: "anthropic",
    model,
    content: "",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    latencyMs: Date.now() - startedAt,
    status: "failed",
    error,
    raw
  };
}
