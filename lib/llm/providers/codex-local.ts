import { execFile } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import type { LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

const execFileAsync = promisify(execFile);

type OpenAICompatibleResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
  };
};

type OpenClawRunResponse = {
  ok?: boolean;
  provider?: string;
  model?: string;
  outputs?: Array<{ text?: string | null }>;
};

export function getCodexLocalBaseUrl() {
  return process.env.CODEX_LOCAL_BASE_URL || process.env.OPENCLAW_GATEWAY_URL || "";
}

export function isCodexLocalConfigured() {
  return Boolean(getCodexLocalBaseUrl() || process.env.OPENCLAW_CLI_ENABLED === "true");
}

export const codexLocalProvider: LLMProviderAdapter = {
  name: "codex_local",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const baseUrl = getCodexLocalBaseUrl().replace(/\/$/, "");
    const model = normalizeModel(input.model || process.env.CODEX_LOCAL_MODEL || "openai/gpt-5.5");

    if (baseUrl === "cli" || process.env.OPENCLAW_CLI_ENABLED === "true") {
      return runViaOpenClawCli(input, model, startedAt);
    }

    if (!baseUrl) {
      return {
        provider: "codex_local",
        model,
        content: "",
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        latencyMs: Date.now() - startedAt,
        status: "failed",
        error: "CODEX_LOCAL_BASE_URL=cli, OPENCLAW_CLI_ENABLED=true, or OPENCLAW_GATEWAY_URL is not configured"
      };
    }

    return runViaOpenAICompatibleGateway(input, baseUrl, model, startedAt);
  }
};

async function runViaOpenClawCli(
  input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput,
  model: string,
  startedAt: number
): Promise<RunLLMResult> {
  try {
    const openclawEntry = path.join(process.cwd(), "tools", "openclaw-prefix", "node_modules", "openclaw", "openclaw.mjs");
    const nodeDir = path.join(process.cwd(), "tools", "node");
    const nodeBin = path.join(nodeDir, process.platform === "win32" ? "node.exe" : "node");
    const openclawDir = path.join(process.cwd(), "tools", "openclaw-prefix");
    const hasBundledCli = fs.existsSync(nodeBin) && fs.existsSync(openclawEntry);
    const executable = hasBundledCli ? nodeBin : process.platform === "win32" ? "openclaw.cmd" : "openclaw";
    const prompt = buildPrompt(input);
    const args = ["infer", "model", "run", "--local", "--json", "--model", model, "--prompt", prompt];

    const { stdout } = await execFileAsync(
      executable,
      hasBundledCli ? [openclawEntry, ...args] : args,
      {
        cwd: process.cwd(),
        timeout: Number(process.env.OPENCLAW_CLI_TIMEOUT_MS ?? 180000),
        maxBuffer: 1024 * 1024 * 4,
        env: {
          ...process.env,
          PATH: hasBundledCli
            ? `${nodeDir}${path.delimiter}${openclawDir}${path.delimiter}${process.env.PATH ?? ""}`
            : process.env.PATH ?? ""
        }
      }
    );

    const parsed = parseFirstJsonObject<OpenClawRunResponse>(stdout);
    const content = parsed.outputs?.map((output) => output.text ?? "").join("\n").trim() ?? "";

    if (!parsed.ok) {
      throw new Error(stdout.trim() || "OpenClaw CLI returned a failed response");
    }

    return {
      provider: "codex_local",
      model: parsed.model ? `${parsed.provider ?? "openai"}/${parsed.model}` : model,
      content,
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      status: "succeeded",
      raw: parsed
    };
  } catch (error) {
    return {
      provider: "codex_local",
      model,
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      error: error instanceof Error ? error.message : "OpenClaw CLI request failed"
    };
  }
}

async function runViaOpenAICompatibleGateway(
  input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput,
  baseUrl: string,
  model: string,
  startedAt: number
): Promise<RunLLMResult> {
  try {
    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.CODEX_LOCAL_API_KEY ? { Authorization: `Bearer ${process.env.CODEX_LOCAL_API_KEY}` } : {})
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
        tools: input.tools
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || `Codex local gateway returned ${response.status}`);
    }

    const data = (await response.json()) as OpenAICompatibleResponse;
    const inputTokens = data.usage?.prompt_tokens ?? 0;
    const outputTokens = data.usage?.completion_tokens ?? 0;

    return {
      provider: "codex_local",
      model,
      content: data.choices?.[0]?.message?.content ?? "",
      inputTokens,
      outputTokens,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      status: "succeeded",
      raw: data
    };
  } catch (error) {
    return {
      provider: "codex_local",
      model,
      content: "",
      inputTokens: 0,
      outputTokens: 0,
      estimatedCost: 0,
      latencyMs: Date.now() - startedAt,
      status: "failed",
      error: error instanceof Error ? error.message : "Codex local gateway request failed"
    };
  }
}

function buildPrompt(input: RunLLMInput) {
  return input.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n---\n\n");
}

function parseFirstJsonObject<T>(value: string): T {
  const start = value.indexOf("{");
  if (start < 0) throw new Error(value.trim() || "No JSON response from OpenClaw CLI");

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < value.length; index += 1) {
    const char = value[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(value.slice(start, index + 1)) as T;
    }
  }

  throw new Error("Could not parse JSON response from OpenClaw CLI");
}

function normalizeModel(model: string) {
  if (model.startsWith("openai/")) return model;
  if (model.startsWith("codex/")) return model.replace(/^codex\//, "openai/");
  if (model.includes("/")) return model;
  return `openai/${model}`;
}
