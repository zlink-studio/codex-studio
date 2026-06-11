import type { Agent, ModelPolicy, ModelProviderName, RiskLevel } from "@/lib/types";

export type LLMRole = "system" | "user" | "assistant" | "tool";

export type LLMMessage = {
  role: LLMRole;
  content: string;
  name?: string;
};

export type RunLLMInput = {
  model?: string;
  provider?: ModelProviderName;
  messages: LLMMessage[];
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  tools?: unknown[];
  metadata?: Record<string, unknown>;
};

export type RunLLMResult = {
  provider: ModelProviderName;
  model: string;
  content: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  latencyMs: number;
  status: "succeeded" | "failed";
  error?: string;
  raw?: unknown;
};

export type ModelRoutingContext = {
  agent?: Partial<Agent> | null;
  taskType?: string | null;
  riskLevel?: RiskLevel | null;
  preferredPolicy?: string | null;
};

export type LLMProviderAdapter = {
  name: ModelProviderName;
  run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult>;
};

export type ResolvedModelPolicy = ModelPolicy & {
  needApproval: boolean;
};
