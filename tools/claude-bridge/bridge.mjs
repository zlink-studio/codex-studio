// Claude bridge: lets the ZLink Studio website use this VPS's logged-in Claude Code
// (claude.ai subscription) instead of an API key. Single-owner, personal use.
//
// Security model:
// - HTTPS with a self-signed cert the website pins (CA = this cert).
// - Every request needs `Authorization: Bearer $BRIDGE_TOKEN`.
// - `claude` runs with ALL built-in tools disabled (--tools ""), no user settings,
//   hooks or CLAUDE.md (--setting-sources ""), in an empty working dir. The only
//   tools it can use are the website's own MCP tools, for the console.
// - At most MAX_CONCURRENT claude processes; each is killed after a timeout or
//   when the caller disconnects.

import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { timingSafeEqual } from "node:crypto";
import https from "node:https";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = loadEnv(path.join(here, "bridge.env"));

const PORT = Number(env.BRIDGE_PORT || 18443);
const TOKEN = env.BRIDGE_TOKEN || "";
const CLAUDE_BIN = env.CLAUDE_BIN || "claude";
const WORK_DIR = path.join(here, "work");
const MCP_URL = env.ZLINK_MCP_URL || "";
const MCP_TOKEN = env.ZLINK_MCP_TOKEN || "";
const MAX_CONCURRENT = Number(env.MAX_CONCURRENT || 2);
const TIMEOUT_MS = Number(env.TIMEOUT_MS || 280_000);
const MAX_BODY = 512 * 1024;
const MODELS = new Set(["opus", "sonnet", "haiku", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"]);

if (TOKEN.length < 32) {
  console.error("BRIDGE_TOKEN missing or too short in bridge.env");
  process.exit(1);
}

const CONSOLE_PROMPT = `你是 ZLink Studio OS 工作台里的 Claude 控制台，直接为主理人（老板）服务。

工作台是一人公司的 AI 数字员工系统：老板给目标 → 拆成项目和任务 → 各岗位 Agent 用模型路由执行（规划和复核走 Claude，执行走 GPT 等模型）→ 高风险动作进入老板审批（L0–L3）。

你只能通过 zlink 工具查看系统状态、项目、任务和老板收件箱，以及按老板要求创建项目（自动拆解任务）和执行下一个任务。你没有文件、命令行或网络工具。

规则：
- 回答简洁直接，像命令行助手：先给结论，再给必要细节。用中文回复，除非老板用其他语言。
- 查询类问题先调用工具拿真实数据再回答，不要编造项目、任务或数字。
- 创建项目、执行任务这类会写入数据或调用模型的操作，只在老板明确要求时才做；目标模糊时先问清楚再创建。
- 不要绕过审批：等待审批的任务不能执行，提醒老板去 Owner Inbox 处理。
- 工具报错时，如实说明错误和可能原因（例如未配置 Supabase 或模型 Key），并建议下一步。`;

// Separate pools: a console turn can trigger planning calls (/v1/complete) through
// the website's tools, so sharing one pool could deadlock.
function pool(limit) {
  let active = 0;
  const waiters = [];
  return {
    get active() {
      return active;
    },
    async acquire() {
      if (active >= limit) await new Promise((resolve) => waiters.push(resolve));
      active += 1;
    },
    release() {
      active -= 1;
      waiters.shift()?.();
    }
  };
}

const consolePool = pool(MAX_CONCURRENT);
const completePool = pool(MAX_CONCURRENT + 1);

function loadEnv(file) {
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) out[match[1]] = match[2];
  }
  return out;
}

function authorized(req) {
  const header = req.headers.authorization || "";
  const given = Buffer.from(header.startsWith("Bearer ") ? header.slice(7) : "");
  const expected = Buffer.from(TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
      } else chunks.push(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}"));
      } catch {
        reject(new Error("invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function json(res, status, payload) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function pickModel(value) {
  return typeof value === "string" && MODELS.has(value) ? value : "opus";
}

function baseArgs(model) {
  return ["--tools", "", "--strict-mcp-config", "--setting-sources", "", "--model", model];
}

// Run claude and call onLine for each stdout line. Resolves with exit code.
function runClaude(args, input, { onLine, signal }) {
  return new Promise((resolve) => {
    const child = spawn(CLAUDE_BIN, args, {
      cwd: WORK_DIR,
      stdio: ["pipe", "pipe", "pipe"]
    });
    let stderr = "";
    let buffer = "";
    const timer = setTimeout(() => child.kill("SIGTERM"), TIMEOUT_MS);
    const abort = () => child.kill("SIGTERM");
    signal?.addEventListener("abort", abort);

    child.stdout.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) if (line.trim()) onLine(line);
    });
    child.stderr.on("data", (chunk) => {
      stderr = (stderr + chunk.toString("utf8")).slice(-4000);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      if (buffer.trim()) onLine(buffer);
      resolve({ code, stderr });
    });
    child.stdin.end(input);
  });
}

// One-shot completion for planning / review. No tools, no session kept.
async function handleComplete(req, res) {
  const body = await readBody(req);
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  if (!prompt.trim()) return json(res, 400, { error: "prompt is required" });
  const model = pickModel(body.model);
  const args = ["-p", ...baseArgs(model), "--no-session-persistence", "--output-format", "json"];
  if (typeof body.system === "string" && body.system.trim()) args.push("--system-prompt", body.system);

  const controller = new AbortController();
  res.on("close", () => controller.abort());
  await completePool.acquire();
  let result = null;
  try {
    const { code, stderr } = await runClaude(args, prompt, {
      signal: controller.signal,
      onLine: (line) => {
        try {
          result = JSON.parse(line);
        } catch {
          // ignore non-JSON lines
        }
      }
    });
    if (!result || result.is_error || code !== 0) {
      return json(res, 502, { error: result?.result || stderr.trim() || `claude exited with ${code}` });
    }
    const usage = result.usage || {};
    json(res, 200, {
      text: result.result ?? "",
      model: Object.keys(result.modelUsage || {})[0] || model,
      inputTokens: (usage.input_tokens || 0) + (usage.cache_read_input_tokens || 0) + (usage.cache_creation_input_tokens || 0),
      outputTokens: usage.output_tokens || 0,
      costUsd: result.total_cost_usd || 0
    });
  } finally {
    completePool.release();
  }
}

// Streaming console turn. The conversation lives in a claude session on this VPS;
// the website only keeps the session id.
async function handleConsole(req, res) {
  const body = await readBody(req);
  const message = typeof body.message === "string" ? body.message : "";
  if (!message.trim()) return json(res, 400, { error: "message is required" });
  const sessionId = typeof body.session_id === "string" && /^[0-9a-f-]{36}$/.test(body.session_id) ? body.session_id : null;
  const model = pickModel(body.model);

  const args = [
    "-p",
    ...baseArgs(model),
    "--output-format",
    "stream-json",
    "--verbose",
    "--include-partial-messages",
    "--system-prompt",
    CONSOLE_PROMPT
  ];
  if (MCP_URL && MCP_TOKEN) {
    args.push(
      "--mcp-config",
      JSON.stringify({
        mcpServers: { zlink: { type: "http", url: MCP_URL, headers: { Authorization: `Bearer ${MCP_TOKEN}` } } }
      }),
      "--allowedTools",
      "mcp__zlink__*"
    );
  }
  if (sessionId) args.push("--resume", sessionId);

  const controller = new AbortController();
  res.on("close", () => controller.abort());
  await consolePool.acquire();
  res.writeHead(200, { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" });
  const send = (event) => res.write(`${JSON.stringify(event)}\n`);
  const toolNames = new Map();
  let finalSession = sessionId;
  let done = false;

  try {
    const { code, stderr } = await runClaude(args, message, {
      signal: controller.signal,
      onLine: (line) => {
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.session_id) finalSession = event.session_id;
        if (event.type === "stream_event" && event.event?.type === "content_block_delta" && event.event.delta?.type === "text_delta") {
          send({ type: "text", text: event.event.delta.text });
        } else if (event.type === "assistant") {
          for (const block of event.message?.content || []) {
            if (block.type === "tool_use") {
              const name = String(block.name || "").replace(/^mcp__zlink__/, "");
              toolNames.set(block.id, name);
              send({ type: "tool_use", id: block.id, name, input: block.input });
            }
          }
        } else if (event.type === "user") {
          const content = Array.isArray(event.message?.content) ? event.message.content : [];
          for (const block of content) {
            if (block.type === "tool_result") {
              const text = Array.isArray(block.content)
                ? block.content.map((part) => part.text ?? "").join("")
                : String(block.content ?? "");
              send({ type: "tool_result", id: block.tool_use_id, name: toolNames.get(block.tool_use_id) || "", content: text, isError: Boolean(block.is_error) });
            }
          }
        } else if (event.type === "result") {
          done = true;
          if (event.is_error) send({ type: "error", message: String(event.result || "claude reported an error") });
          send({
            type: "done",
            session_id: finalSession,
            messages: [],
            usage: { inputTokens: 0, outputTokens: event.usage?.output_tokens || 0, cost: 0 },
            model
          });
        }
      }
    });
    if (!done && !controller.signal.aborted) {
      send({ type: "error", message: stderr.trim().slice(-500) || `claude exited with ${code}` });
    }
  } finally {
    consolePool.release();
    res.end();
  }
}

const server = https.createServer(
  { key: readFileSync(path.join(here, "tls/key.pem")), cert: readFileSync(path.join(here, "tls/cert.pem")) },
  async (req, res) => {
    try {
      if (!authorized(req)) return json(res, 401, { error: "unauthorized" });
      if (req.method === "GET" && req.url === "/health") {
        return json(res, 200, { ok: true, console: consolePool.active, complete: completePool.active, mcp: Boolean(MCP_URL && MCP_TOKEN) });
      }
      if (req.method === "POST" && req.url === "/v1/complete") return await handleComplete(req, res);
      if (req.method === "POST" && req.url === "/v1/console") return await handleConsole(req, res);
      json(res, 404, { error: "not found" });
    } catch (error) {
      if (!res.headersSent) json(res, 400, { error: error instanceof Error ? error.message : "bad request" });
      else res.end();
    }
  }
);

server.requestTimeout = TIMEOUT_MS + 30_000;
server.listen(PORT, "0.0.0.0", () => console.log(`[claude-bridge] listening on :${PORT}`));
