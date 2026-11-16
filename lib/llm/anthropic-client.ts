import Anthropic from "@anthropic-ai/sdk";

// Shared Claude client for the provider adapter and the console.
// Server-only: never import this from a client component.

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5-5";

// Server-side refusal fallback: if the primary model declines, the API re-runs the
// request on a fallback model inside the same call (routes by refusal category).
export const CLAUDE_FALLBACK_BETA = "server-side-fallback-2026-07-01";

// USD per 1M tokens (input, output) for cost estimates shown in the workbench.
const PRICING: Record<string, { input: number; output: number }> = {
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-haiku-5-5": { input: 0.1, output: 0.5 }
};

let cachedClient: Anthropic | null = null;

export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function getClaudeModel(override?: string | null) {
  const model = override?.trim() || process.env.ANTHROPIC_MODEL?.trim();
  return model || DEFAULT_CLAUDE_MODEL;
}

export function getAnthropicClient() {
  if (!isAnthropicConfigured()) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }
  cachedClient ??= new Anthropic();
  return cachedClient;
}

export function estimateClaudeCost(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICING[model];
  if (!price) return 0;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
