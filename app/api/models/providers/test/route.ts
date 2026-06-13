import { fail, ok, parseJson } from "@/lib/api";
import { getProviderStatus } from "@/lib/llm/catalog";
import { runLLM } from "@/lib/llm/router";
import type { ModelProviderName } from "@/lib/types";

type TestBody = {
  provider?: ModelProviderName;
  model?: string;
};

export async function POST(request: Request) {
  const body = await parseJson<TestBody>(request);
  const provider = body?.provider ?? "openai";
  const model = body?.model ?? defaultTestModel(provider);
  const status = getProviderStatus(provider, provider !== "openrouter" && provider !== "litellm");

  if (provider === "manual_bridge") {
    return ok({
      provider,
      model,
      status,
      message: status === "configured" ? "Manual bridge mode is enabled." : "Set LLM_NO_KEY_MODE=manual_bridge to enable manual bridge mode."
    });
  }

  if (provider !== "openai" && provider !== "codex_local" && provider !== "gemini") {
    return ok({
      provider,
      model,
      status,
      message: status === "missing_key" ? "API key is not configured." : "Placeholder adapter. Not enabled in MVP."
    });
  }

  if (status !== "configured") {
    return ok({
      provider,
      model,
      status,
      message:
        provider === "codex_local"
          ? "CODEX_LOCAL_BASE_URL or OPENCLAW_GATEWAY_URL is not configured."
          : provider === "gemini"
            ? "GEMINI_API_KEY is not configured."
          : "OPENAI_API_KEY is not configured."
    });
  }

  const result = await runLLM({
    provider,
    model,
    messages: [{ role: "user", content: "Reply with the single word: ok" }],
    temperature: 0,
    maxTokens: 8
  });

  if (result.status === "failed") {
    return fail(result.error ?? "Connection test failed", 502);
  }

  return ok({
    provider,
    model: result.model,
    status: "configured",
    latencyMs: result.latencyMs,
    message: "Connection succeeded."
  });
}

function defaultTestModel(provider: ModelProviderName) {
  if (provider === "codex_local") return process.env.CODEX_LOCAL_MODEL || "openai/gpt-4o-mini";
  if (provider === "manual_bridge") return "chatgpt-web-manual";
  if (provider === "openai") return "gpt-4o-mini";
  if (provider === "gemini") return process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  return "placeholder";
}
