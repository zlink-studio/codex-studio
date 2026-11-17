import https from "node:https";
import type { IncomingMessage } from "node:http";

// Client for the Claude bridge on the owner's VPS, which runs the logged-in Claude
// Code CLI (claude.ai subscription) so the workbench needs no Anthropic API key.
// Normally reached through a Cloudflare tunnel (public certificate). When the
// bridge is reached directly, CLAUDE_BRIDGE_CA (base64 PEM) pins its self-signed
// certificate and nothing else is trusted.

function config() {
  const url = process.env.CLAUDE_BRIDGE_URL?.trim();
  const token = process.env.CLAUDE_BRIDGE_TOKEN?.trim();
  const caB64 = process.env.CLAUDE_BRIDGE_CA?.trim();
  if (!url || !token) return null;
  return { url: url.replace(/\/$/, ""), token, ca: caB64 ? Buffer.from(caB64, "base64").toString("utf8") : undefined };
}

export function isClaudeBridgeConfigured() {
  return config() !== null;
}

export class ClaudeBridgeError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
  }
}

// POST JSON to the bridge and return the raw response stream (status checked by caller).
export function bridgeRequest(path: string, body: unknown, signal?: AbortSignal): Promise<IncomingMessage> {
  const settings = config();
  if (!settings) return Promise.reject(new ClaudeBridgeError("Claude bridge is not configured."));
  const payload = Buffer.from(JSON.stringify(body));
  const target = new URL(`${settings.url}${path}`);

  return new Promise((resolve, reject) => {
    const request = https.request(
      target,
      {
        method: "POST",
        ...(settings.ca ? { ca: settings.ca } : {}),
        headers: {
          authorization: `Bearer ${settings.token}`,
          "content-type": "application/json",
          "content-length": payload.length
        },
        signal
      },
      resolve
    );
    request.setTimeout(290_000, () => request.destroy(new ClaudeBridgeError("Claude bridge timed out.")));
    request.on("error", (error) =>
      reject(error instanceof ClaudeBridgeError ? error : new ClaudeBridgeError(`Claude bridge unreachable: ${error.message}`))
    );
    request.end(payload);
  });
}

async function readAll(response: IncomingMessage) {
  const chunks: Buffer[] = [];
  for await (const chunk of response) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
}

export type BridgeCompletion = {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

// Current public URL of the CloudCLI gate tunnel on the VPS (changes when the
// tunnel restarts, so it is looked up on demand instead of stored in env).
export async function bridgeCliUrl(): Promise<string> {
  const settings = config();
  if (!settings) throw new ClaudeBridgeError("Claude bridge is not configured.");
  const response = await fetch(`${settings.url}/cli-url`, {
    headers: { authorization: `Bearer ${settings.token}` },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000)
  });
  const payload = (await response.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!response.ok || !payload?.url) {
    throw new ClaudeBridgeError(payload?.error ?? `Claude bridge returned HTTP ${response.status}`, response.status);
  }
  return payload.url;
}

export async function bridgeComplete(input: { system?: string; prompt: string; model?: string }): Promise<BridgeCompletion> {
  const response = await bridgeRequest("/v1/complete", input);
  const text = await readAll(response);
  let payload: any = null;
  try {
    // The bridge sends newline heartbeats before the JSON body.
    payload = JSON.parse(text.trim());
  } catch {
    // fall through to the status error below
  }
  if (response.statusCode !== 200 || !payload || payload.error) {
    throw new ClaudeBridgeError(payload?.error ?? `Claude bridge returned HTTP ${response.statusCode}`, response.statusCode);
  }
  return payload as BridgeCompletion;
}
