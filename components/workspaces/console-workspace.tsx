"use client";

import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type Anthropic from "@anthropic-ai/sdk";
import { ChevronDown, ChevronRight, CornerDownLeft, Square, Terminal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type ApiMessage = Anthropic.Beta.BetaMessageParam;
type ModelKey = "opus" | "sonnet";

type Entry =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "assistant"; text: string }
  | { id: string; kind: "tool"; toolId: string; name: string; input: unknown; result?: string; isError?: boolean }
  | { id: string; kind: "notice"; text: string; tone: "info" | "error" };

type ServerEvent =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown }
  | { type: "tool_result"; id: string; name: string; content: string; isError: boolean }
  | { type: "done"; messages: ApiMessage[]; session_id?: string | null; usage: { inputTokens: number; outputTokens: number; cost: number }; model: string }
  | { type: "error"; message: string };

const STORAGE_KEY = "zl-console-v1";

const TOOL_LABELS: Record<string, string> = {
  get_system_status: "检查系统状态",
  list_projects: "读取项目列表",
  get_project: "读取项目详情",
  list_tasks: "读取任务",
  get_owner_inbox: "读取老板收件箱",
  create_project_from_goal: "创建项目并拆解任务",
  run_next_task: "执行下一个任务"
};

const HELP_TEXT = [
  "/help            显示帮助",
  "/clear           清空对话",
  "/model opus      切换到 Claude Opus 5.5（默认，最强）",
  "/model sonnet    切换到 Claude Sonnet 5.5（更快更省）",
  "/status          检查系统和模型配置",
  "",
  "Enter 发送，Shift+Enter 换行，Esc 停止生成。",
  "试试：「现在有哪些任务在等我审批？」「帮我把『做一个外贸独立站』拆成项目」"
].join("\n");

let idCounter = 0;
const newId = () => `${Date.now().toString(36)}-${(idCounter += 1)}`;

type SavedState = { entries: Entry[]; history: ApiMessage[]; sessionId: string | null; model: ModelKey; cost: number };

function loadState(): SavedState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveState(state: SavedState) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage full or blocked: the console still works for this session.
  }
}

function formatInput(input: unknown) {
  if (!input || typeof input !== "object") return "";
  const text = Object.entries(input as Record<string, unknown>)
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(", ");
  return text.length > 120 ? `${text.slice(0, 120)}…` : text;
}

function ToolLine({ entry }: { entry: Extract<Entry, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const pending = entry.result === undefined;
  return (
    <div className="font-mono text-[12px] leading-5">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start gap-2 text-left text-moss hover:text-ink"
      >
        <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", pending ? "animate-pulse bg-[#8c87ff]" : entry.isError ? "bg-[#e5484d]" : "bg-[#49c98d]")} />
        <span className="min-w-0">
          <span className="text-ink/90">{TOOL_LABELS[entry.name] ?? entry.name}</span>
          <span className="text-moss/60"> ({formatInput(entry.input)})</span>
        </span>
        {pending ? null : open ? <ChevronDown size={14} className="ml-auto mt-0.5 shrink-0" /> : <ChevronRight size={14} className="ml-auto mt-0.5 shrink-0" />}
      </button>
      {!pending ? (
        <div className="ml-[14px] border-l border-line pl-3 text-moss/70">
          {open ? (
            <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap break-words text-[11px]">{entry.result}</pre>
          ) : (
            <span className={cn("text-[11px]", entry.isError && "text-[#ff8a8f]")}>
              ⎿ {entry.isError ? `出错：${(entry.result ?? "").slice(0, 160)}` : `完成（${(entry.result ?? "").length} 字符，点击展开）`}
            </span>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function ConsoleWorkspace() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [history, setHistory] = useState<ApiMessage[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [model, setModel] = useState<ModelKey>("opus");
  const [cost, setCost] = useState(0);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const saved = loadState();
    if (saved) {
      setEntries(saved.entries ?? []);
      setHistory(saved.history ?? []);
      setSessionId(saved.sessionId ?? null);
      setModel(saved.model === "sonnet" ? "sonnet" : "opus");
      setCost(Number(saved.cost) || 0);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded && !busy) saveState({ entries, history, sessionId, model, cost });
  }, [loaded, busy, entries, history, sessionId, model, cost]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [entries]);

  const pushNotice = (text: string, tone: "info" | "error" = "info") =>
    setEntries((current) => [...current, { id: newId(), kind: "notice", text, tone }]);

  const appendAssistantText = (text: string) =>
    setEntries((current) => {
      const last = current[current.length - 1];
      if (last?.kind === "assistant") {
        return [...current.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...current, { id: newId(), kind: "assistant", text }];
    });

  const send = useCallback(
    async (text: string) => {
      const userMessage: ApiMessage = { role: "user", content: text };
      const requestHistory = [...history, userMessage];
      setEntries((current) => [...current, { id: newId(), kind: "user", text }]);
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      let finished = false;

      try {
        const response = await fetch("/api/console", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ messages: requestHistory, session_id: sessionId, model }),
          signal: controller.signal
        });
        if (!response.ok || !response.body) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error ?? `请求失败（HTTP ${response.status}）`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as ServerEvent;
            if (event.type === "text") appendAssistantText(event.text);
            else if (event.type === "tool_use") {
              setEntries((current) => [...current, { id: newId(), kind: "tool", toolId: event.id, name: event.name, input: event.input }]);
            } else if (event.type === "tool_result") {
              setEntries((current) =>
                current.map((entry) =>
                  entry.kind === "tool" && entry.toolId === event.id ? { ...entry, result: event.content, isError: event.isError } : entry
                )
              );
            } else if (event.type === "done") {
              finished = true;
              setHistory([...requestHistory, ...event.messages]);
              if (event.session_id) setSessionId(event.session_id);
              setCost((current) => current + event.usage.cost);
            } else if (event.type === "error") {
              pushNotice(event.message, "error");
            }
          }
        }
      } catch (error) {
        if (controller.signal.aborted) pushNotice("已停止。");
        else pushNotice(error instanceof Error ? error.message : "请求失败", "error");
      } finally {
        // An incomplete turn is not added to history, so the next message starts
        // cleanly from the last complete turn.
        if (!finished) pushNotice("这一轮没有完成，下一条消息会从上一轮完整对话继续。");
        abortRef.current = null;
        setBusy(false);
        inputRef.current?.focus();
      }
    },
    [history, sessionId, model]
  );

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");

    if (text.startsWith("/")) {
      const [command, arg] = text.split(/\s+/, 2);
      if (command === "/clear") {
        setEntries([]);
        setHistory([]);
        setSessionId(null);
        setCost(0);
        return;
      }
      if (command === "/help") {
        pushNotice(HELP_TEXT);
        return;
      }
      if (command === "/model") {
        if (arg === "opus" || arg === "sonnet") {
          setModel(arg);
          pushNotice(`已切换到 ${arg === "opus" ? "Claude Opus 5.5" : "Claude Sonnet 5.5"}。`);
        } else {
          pushNotice(`当前模型：${model}。用法：/model opus 或 /model sonnet`);
        }
        return;
      }
      if (command === "/status") {
        void send("检查一下系统状态和模型配置，告诉我还缺什么才能正常使用。");
        return;
      }
      pushNotice(`未知命令 ${command}，输入 /help 查看可用命令。`, "error");
      return;
    }
    void send(text);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    } else if (event.key === "Escape" && busy) {
      abortRef.current?.abort();
    }
  };

  return (
    <section className="flex h-[calc(100vh-58px-64px)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-[#0b0c0e]">
      <header className="flex items-center gap-3 border-b border-line px-4 py-2.5">
        <Terminal size={15} className="text-[#aaa8ff]" />
        <span className="font-mono text-[12px] text-ink">claude</span>
        <span className="font-mono text-[11px] text-moss/60">· {model === "opus" ? "Opus 5.5" : "Sonnet 5.5"}</span>
        <span className="ml-auto font-mono text-[10px] text-moss/50">{cost > 0 ? `本会话约 $${cost.toFixed(3)}` : "VPS Claude Code"}</span>
        <button
          type="button"
          onClick={() => {
            setEntries([]);
            setHistory([]);
            setSessionId(null);
            setCost(0);
          }}
          disabled={busy}
          aria-label="清空对话"
          className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink disabled:opacity-40"
        >
          <Trash2 size={13} />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {entries.length === 0 ? (
          <div className="font-mono text-[12px] leading-6 text-moss">
            <p className="text-ink">✻ ZLink Studio · Claude 控制台</p>
            <p className="mt-1 whitespace-pre-wrap text-moss/70">{HELP_TEXT}</p>
          </div>
        ) : null}
        {entries.map((entry) => {
          if (entry.kind === "user") {
            return (
              <div key={entry.id} className="flex gap-2 font-mono text-[13px] leading-6">
                <span className="text-[#8c87ff]">&gt;</span>
                <p className="min-w-0 whitespace-pre-wrap break-words text-ink">{entry.text}</p>
              </div>
            );
          }
          if (entry.kind === "assistant") {
            return (
              <div key={entry.id} className="flex gap-2 text-[13px] leading-6">
                <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-ink/70" />
                <p className="min-w-0 whitespace-pre-wrap break-words text-ink/90">{entry.text}</p>
              </div>
            );
          }
          if (entry.kind === "tool") return <ToolLine key={entry.id} entry={entry} />;
          return (
            <pre
              key={entry.id}
              className={cn(
                "whitespace-pre-wrap break-words font-mono text-[12px] leading-5",
                entry.tone === "error" ? "text-[#ff8a8f]" : "text-moss/80"
              )}
            >
              {entry.text}
            </pre>
          );
        })}
        {busy ? <p className="animate-pulse font-mono text-[11px] text-moss/60">✻ 思考中…（Esc 停止）</p> : null}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-line p-3">
        <div className="flex items-end gap-2 rounded-lg border border-line bg-white/[0.02] px-3 py-2 focus-within:border-[#5e6ad2]">
          <span className="pb-1 font-mono text-[13px] text-[#8c87ff]">&gt;</span>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={onKeyDown}
            rows={Math.min(6, Math.max(1, input.split("\n").length))}
            placeholder="给 Claude 下指令，或输入 /help"
            className="min-w-0 flex-1 resize-none bg-transparent font-mono text-[13px] leading-6 text-ink outline-none placeholder:text-moss/40"
            autoFocus
          />
          {busy ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              aria-label="停止"
              className="grid h-8 w-8 place-items-center rounded-md border border-line text-moss hover:text-ink"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={!input.trim()}
              aria-label="发送"
              className="grid h-8 w-8 place-items-center rounded-md bg-[#e9e5dd] text-[#222125] disabled:opacity-30"
            >
              <CornerDownLeft size={14} />
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
