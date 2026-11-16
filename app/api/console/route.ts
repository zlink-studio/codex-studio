import Anthropic from "@anthropic-ai/sdk";
import { fail, parseJson } from "@/lib/api";
import { consoleToolDefinitions, runConsoleTool } from "@/lib/console/tools";
import {
  CLAUDE_FALLBACK_BETA,
  estimateClaudeCost,
  getAnthropicClient,
  getClaudeModel,
  isAnthropicConfigured,
  shouldUseClaudeBridge
} from "@/lib/llm/anthropic-client";
import { bridgeRequest } from "@/lib/llm/claude-bridge";

export const dynamic = "force-dynamic";
// An agent turn with tool calls (planning, running a task) can take minutes.
export const maxDuration = 300;

const MODELS: Record<string, string> = {
  opus: "claude-opus-5-5",
  sonnet: "claude-sonnet-5-5"
};

const MAX_TOOL_ROUNDS = 12;
const MAX_HISTORY_MESSAGES = 400;

const SYSTEM_PROMPT = `你是 ZLink Studio OS 工作台里的 Claude 控制台，直接为主理人（老板）服务。

工作台是一人公司的 AI 数字员工系统：老板给目标 → 拆成项目和任务 → 各岗位 Agent 用模型路由执行（规划和复核走 Claude，执行走 GPT 等模型）→ 高风险动作进入老板审批（L0–L3）。

你可以用工具查看系统状态、项目、任务和老板收件箱，也可以按老板要求创建项目（自动拆解任务）和执行下一个任务。

规则：
- 回答简洁直接，像命令行助手：先给结论，再给必要细节。用中文回复，除非老板用其他语言。
- 查询类问题先调用工具拿真实数据再回答，不要编造项目、任务或数字。
- 创建项目、执行任务这类会写入数据或调用模型的操作，只在老板明确要求时才做；目标模糊时先问清楚再创建。
- 不要绕过审批：等待审批的任务不能执行，提醒老板去 Owner Inbox 处理。
- 工具报错时，如实说明错误和可能原因（例如未配置 Supabase 或模型 Key），并建议下一步。`;

type ConsoleBody = {
  messages?: unknown;
  session_id?: string | null;
  model?: string;
};

type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; content: string; isError: boolean }
  | { type: "done"; messages: Anthropic.Beta.BetaMessageParam[]; session_id?: string | null; usage: { inputTokens: number; outputTokens: number; cost: number }; model: string }
  | { type: "error"; message: string };

function isMessageList(value: unknown): value is Anthropic.Beta.BetaMessageParam[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_HISTORY_MESSAGES) return false;
  const valid = value.every(
    (item) =>
      item &&
      typeof item === "object" &&
      (item.role === "user" || item.role === "assistant") &&
      (typeof item.content === "string" || Array.isArray(item.content))
  );
  return valid && value[0].role === "user" && value[value.length - 1].role === "user";
}

function lastUserText(messages: Anthropic.Beta.BetaMessageParam[]) {
  const last = messages[messages.length - 1];
  if (typeof last.content === "string") return last.content;
  return (last.content ?? [])
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();
}

// Bridge mode: the VPS keeps the conversation as a Claude Code session and runs the
// agent loop itself, calling this site's tools through /api/mcp. We pass its
// NDJSON stream straight through.
async function proxyToBridge(request: Request, body: ConsoleBody, messages: Anthropic.Beta.BetaMessageParam[]) {
  const message = lastUserText(messages);
  if (!message) return fail("message is empty");
  try {
    const upstream = await bridgeRequest(
      "/v1/console",
      { message, session_id: body.session_id ?? null, model: body.model === "sonnet" ? "sonnet" : "opus" },
      request.signal
    );
    if (upstream.statusCode !== 200) {
      const chunks: Buffer[] = [];
      for await (const chunk of upstream) chunks.push(Buffer.from(chunk));
      const text = Buffer.concat(chunks).toString("utf8");
      let error = `Claude bridge returned HTTP ${upstream.statusCode}`;
      try {
        error = JSON.parse(text).error ?? error;
      } catch {
        // keep the generic message
      }
      return fail(error, 502);
    }
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of upstream) controller.enqueue(new Uint8Array(chunk));
        } catch {
          // client went away or bridge dropped; end the stream
        } finally {
          controller.close();
        }
      },
      cancel() {
        upstream.destroy();
      }
    });
    return new Response(stream, {
      headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" }
    });
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Claude bridge request failed", 502);
  }
}

export async function POST(request: Request) {
  if (!isAnthropicConfigured()) {
    return fail("Claude 未配置：需要 VPS 上的 Claude 转发服务（CLAUDE_BRIDGE_*）或 ANTHROPIC_API_KEY。", 503);
  }
  const body = await parseJson<ConsoleBody>(request);
  if (!body || !isMessageList(body.messages)) {
    return fail("messages must be a non-empty user/assistant list that starts and ends with a user turn");
  }
  if (shouldUseClaudeBridge()) return proxyToBridge(request, body, body.messages);

  const model = MODELS[body.model ?? ""] ?? getClaudeModel();
  const history: Anthropic.Beta.BetaMessageParam[] = [...body.messages];
  const startLength = history.length;
  const client = getAnthropicClient();
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      let inputTokens = 0;
      let outputTokens = 0;
      let jsonRetries = 0;

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round += 1) {
          const turn = client.beta.messages.stream(
            {
              model,
              max_tokens: 64000,
              system: SYSTEM_PROMPT,
              cache_control: { type: "ephemeral" },
              tools: consoleToolDefinitions,
              messages: history,
              output_config: { effort: "medium" },
              betas: [CLAUDE_FALLBACK_BETA],
              fallbacks: "default"
            },
            { signal: request.signal }
          );
          turn.on("text", (delta) => send({ type: "text", text: delta }));

          let message: Anthropic.Beta.BetaMessage;
          try {
            message = await turn.finalMessage();
            jsonRetries = 0;
          } catch (error) {
            // With eager input streaming, an unparseable tool input rejects the turn;
            // re-issue it a couple of times. API errors are not retried here.
            if (error instanceof Anthropic.APIError || jsonRetries >= 2) throw error;
            jsonRetries += 1;
            round -= 1;
            continue;
          }

          inputTokens += message.usage.input_tokens ?? 0;
          outputTokens += message.usage.output_tokens ?? 0;
          history.push({ role: "assistant", content: message.content });

          if (message.stop_reason === "refusal") {
            send({ type: "text", text: "\n（Claude 拒绝了这个请求。）" });
            break;
          }
          if (message.stop_reason === "pause_turn") continue;

          const toolUses = message.content.filter(
            (block): block is Anthropic.Beta.BetaToolUseBlock => block.type === "tool_use"
          );
          if (toolUses.length === 0) break;
          if (message.stop_reason === "max_tokens") {
            send({ type: "error", message: "工具参数被截断（max_tokens），请把请求拆小一点再试。" });
            history.pop();
            break;
          }

          // Run the turn's tool calls together and answer them in one user message.
          for (const toolUse of toolUses) {
            send({ type: "tool_use", id: toolUse.id, name: toolUse.name, input: toolUse.input });
          }
          const results = await Promise.all(toolUses.map((toolUse) => runConsoleTool(toolUse.name, toolUse.input)));
          const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = toolUses.map((toolUse, index) => {
            send({
              type: "tool_result",
              id: toolUse.id,
              name: toolUse.name,
              content: results[index].content,
              isError: results[index].isError
            });
            return {
              type: "tool_result",
              tool_use_id: toolUse.id,
              content: results[index].content,
              is_error: results[index].isError || undefined
            };
          });
          history.push({ role: "user", content: toolResults });

          if (round === MAX_TOOL_ROUNDS - 1) {
            send({ type: "text", text: "\n（已达到单轮工具调用上限，请继续发送指令。）" });
            // Leave history ending on an assistant turn so the next user message is valid.
            history.push({ role: "assistant", content: "（工具调用已达上限，等待下一条指令。）" });
          }
        }

        send({
          type: "done",
          messages: history.slice(startLength),
          usage: { inputTokens, outputTokens, cost: estimateClaudeCost(model, inputTokens, outputTokens) },
          model
        });
      } catch (error) {
        const message =
          error instanceof Anthropic.APIError
            ? `Claude API error ${error.status ?? ""}: ${error.message}`
            : error instanceof Error
              ? error.message
              : "console request failed";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}
