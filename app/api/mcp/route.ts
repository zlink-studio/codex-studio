import { NextResponse } from "next/server";
import { consoleToolDefinitions, runConsoleTool } from "@/lib/console/tools";
import { safeEqual } from "@/lib/session";

// Minimal stateless MCP server (Streamable HTTP, JSON responses) exposing the
// console tools to the Claude Code instance behind the VPS bridge.
// Auth: `Authorization: Bearer $ZLINK_MCP_TOKEN` (this path skips the owner
// session check in middleware and authenticates here instead).

export const dynamic = "force-dynamic";
// run_next_task executes a full agent run.
export const maxDuration = 300;

const SUPPORTED_VERSIONS = ["2025-11-25", "2025-06-18", "2025-03-26", "2024-11-05"];

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, any>;
};

function authorized(request: Request) {
  const token = process.env.ZLINK_MCP_TOKEN?.trim();
  if (!token || token.length < 32) return false;
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") && safeEqual(header.slice(7), token);
}

function result(id: JsonRpcRequest["id"], value: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result: value };
}

function error(id: JsonRpcRequest["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

async function handle(message: JsonRpcRequest) {
  const { id, method, params } = message;
  switch (method) {
    case "initialize": {
      const requested = String(params?.protocolVersion ?? "");
      return result(id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "zlink-studio", version: "1.0.0" }
      });
    }
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, {
        tools: consoleToolDefinitions.map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.input_schema
        }))
      });
    case "tools/call": {
      const name = String(params?.name ?? "");
      const outcome = await runConsoleTool(name, params?.arguments ?? {});
      return result(id, { content: [{ type: "text", text: outcome.content }], isError: outcome.isError });
    }
    default:
      return error(id, -32601, `Method not found: ${method}`);
  }
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let payload: JsonRpcRequest | JsonRpcRequest[];
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(error(null, -32700, "Parse error"), { status: 400 });
  }

  const messages = Array.isArray(payload) ? payload : [payload];
  // Notifications and responses (no id or no method) need no reply.
  const requests = messages.filter((item) => item && item.method && item.id !== undefined && item.id !== null);
  if (requests.length === 0) return new NextResponse(null, { status: 202 });

  const responses = await Promise.all(requests.map(handle));
  return NextResponse.json(Array.isArray(payload) ? responses : responses[0]);
}

export async function GET() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}

export async function DELETE() {
  return new NextResponse(null, { status: 405, headers: { allow: "POST" } });
}
