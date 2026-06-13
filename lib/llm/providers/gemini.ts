import { GoogleAuth } from "google-auth-library";
import type { LLMMessage, LLMProviderAdapter, RunLLMInput, RunLLMResult } from "@/lib/llm/types";

type GeminiPart = { text: string };
type GeminiContent = { role: "user" | "model"; parts: GeminiPart[] };

type GeminiGenerateResponse = {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
};

export function isGeminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY || isVertexModeConfigured());
}

export const geminiProvider: LLMProviderAdapter = {
  name: "gemini",
  async run(input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput): Promise<RunLLMResult> {
    const startedAt = Date.now();
    const model = input.model || process.env.GEMINI_MODEL || defaultGeminiModel();

    if (process.env.GEMINI_VERTEX_MODE === "true") {
      return runVertexOAuth(input, model, startedAt);
    }

    return runGeminiApiKey(input, model, startedAt);
  }
};

async function runGeminiApiKey(
  input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput,
  model: string,
  startedAt: number
): Promise<RunLLMResult> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return failed(model, startedAt, "GEMINI_API_KEY is not configured. Set GEMINI_VERTEX_MODE=true to use Google OAuth/ADC instead.");
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toGeminiRequestBody(input))
    });

    return parseGeminiResponse(response, model, startedAt, "Gemini API");
  } catch (error) {
    return failed(model, startedAt, error instanceof Error ? error.message : "Gemini API request failed");
  }
}

async function runVertexOAuth(
  input: Required<Pick<RunLLMInput, "model" | "messages">> & RunLLMInput,
  model: string,
  startedAt: number
): Promise<RunLLMResult> {
  const project = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "global";

  if (!project) {
    return failed(model, startedAt, "GOOGLE_CLOUD_PROJECT is required for Gemini Vertex OAuth mode.");
  }

  try {
    const auth = new GoogleAuth({
      scopes: ["https://www.googleapis.com/auth/cloud-platform"]
    });
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    const accessToken = typeof token === "string" ? token : token.token;

    if (!accessToken) {
      return failed(model, startedAt, "Could not obtain Google OAuth access token. Run gcloud auth application-default login or set GOOGLE_APPLICATION_CREDENTIALS.");
    }

    const endpoint = `https://${location === "global" ? "aiplatform.googleapis.com" : `${location}-aiplatform.googleapis.com`}/v1/projects/${project}/locations/${location}/publishers/google/models/${model}:generateContent`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(toGeminiRequestBody(input))
    });

    return parseGeminiResponse(response, model, startedAt, "Vertex AI Gemini");
  } catch (error) {
    return failed(model, startedAt, error instanceof Error ? error.message : "Vertex AI Gemini request failed");
  }
}

async function parseGeminiResponse(response: Response, model: string, startedAt: number, label: string): Promise<RunLLMResult> {
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `${label} returned ${response.status}`);
  }

  const data = (await response.json()) as GeminiGenerateResponse;
  const content = data.candidates?.[0]?.content?.parts?.map((part) => part.text).join("") ?? "";
  const inputTokens = data.usageMetadata?.promptTokenCount ?? 0;
  const outputTokens = data.usageMetadata?.candidatesTokenCount ?? 0;

  return {
    provider: "gemini",
    model,
    content,
    inputTokens,
    outputTokens,
    estimatedCost: 0,
    latencyMs: Date.now() - startedAt,
    status: "succeeded",
    raw: data
  };
}

function toGeminiRequestBody(input: RunLLMInput) {
  return {
    ...toGeminiPayload(input.messages),
    generationConfig: {
      temperature: input.temperature ?? 0.2,
      maxOutputTokens: input.maxTokens,
      responseMimeType: input.responseFormat === "json_object" ? "application/json" : undefined
    }
  };
}

function toGeminiPayload(messages: LLMMessage[]) {
  const systemText = messages.filter((message) => message.role === "system").map((message) => message.content).join("\n\n");
  const nonSystem = messages.filter((message) => message.role !== "system");
  const contents: GeminiContent[] = nonSystem.map((message) => ({
    role: message.role === "assistant" ? "model" : "user",
    parts: [{ text: message.content }]
  }));

  return {
    ...(systemText ? { systemInstruction: { parts: [{ text: systemText }] } } : {}),
    contents: contents.length ? contents : [{ role: "user" as const, parts: [{ text: "" }] }]
  };
}

function failed(model: string, startedAt: number, error: string): RunLLMResult {
  return {
    provider: "gemini",
    model,
    content: "",
    inputTokens: 0,
    outputTokens: 0,
    estimatedCost: 0,
    latencyMs: Date.now() - startedAt,
    status: "failed",
    error
  };
}

function isVertexModeConfigured() {
  return process.env.GEMINI_VERTEX_MODE === "true" && Boolean(process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT);
}

function defaultGeminiModel() {
  return process.env.GEMINI_VERTEX_MODE === "true" ? "gemini-2.5-flash" : "gemini-3.1-flash-lite";
}
