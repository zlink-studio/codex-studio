import { createHmac } from "node:crypto";
import { fail, ok } from "@/lib/api";
import { bridgeCliUrl, isClaudeBridgeConfigured } from "@/lib/llm/claude-bridge";

// Issues a one-time, 2-minute pass for the CloudCLI gate on the VPS. Only reachable
// with an owner session (middleware), so only the logged-in owner can open CloudCLI.

export const dynamic = "force-dynamic";

const TICKET_TTL_SECONDS = 110;

export async function GET() {
  const secret = process.env.CLI_GATE_SECRET?.trim();
  if (!secret || secret.length < 32 || !isClaudeBridgeConfigured()) {
    return fail("CloudCLI 远程访问未配置（需要 CLI_GATE_SECRET 和 Claude 转发服务）。", 503);
  }
  try {
    const base = await bridgeCliUrl();
    const expiresAt = Math.floor(Date.now() / 1000) + TICKET_TTL_SECONDS;
    const signature = createHmac("sha256", secret).update(`ticket.${expiresAt}`).digest("hex");
    return ok({ url: `${base.replace(/\/$/, "")}/__zl_gate?t=${expiresAt}.${signature}` });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "CloudCLI 暂时不可用", 502);
  }
}
