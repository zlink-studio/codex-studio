"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppWindow, ExternalLink, RotateCw, Settings2 } from "lucide-react";

// Embeds CloudCLI (Claude Code web UI on the VPS).
// Remote mode (default): the OS asks /api/cli-ticket for a one-time pass to the
// CloudCLI gate behind a Cloudflare tunnel, so no SSH tunnel is needed.
// Manual mode: a fixed address such as http://localhost:3001 over an SSH tunnel.

const STORAGE_KEY = "zl-cloudcli-url";
const DEFAULT_MANUAL_URL = process.env.NEXT_PUBLIC_CLOUDCLI_URL || "http://localhost:3001";

function readSavedUrl() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveUrl(value: string | null) {
  try {
    if (value) window.localStorage.setItem(STORAGE_KEY, value);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage blocked: the choice applies to this visit only
  }
}

function isValidUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function fetchTicketUrl() {
  const response = await fetch("/api/cli-ticket", { cache: "no-store" });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.data?.url) throw new Error(payload?.error ?? `HTTP ${response.status}`);
  return String(payload.data.url);
}

export function ConsoleWorkspace() {
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [frameUrl, setFrameUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [draft, setDraft] = useState(DEFAULT_MANUAL_URL);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(async (manual: string | null) => {
    setError(null);
    setLoaded(false);
    setSlow(false);
    if (manual) {
      setFrameUrl(`${manual}${manual.includes("?") ? "&" : "?"}_=${Date.now()}`);
      return;
    }
    try {
      setFrameUrl(await fetchTicketUrl());
    } catch (cause) {
      setFrameUrl(null);
      setError(cause instanceof Error ? cause.message : "CloudCLI 暂时不可用");
    }
  }, []);

  useEffect(() => {
    const saved = readSavedUrl();
    const manual = saved && isValidUrl(saved) ? saved : null;
    setManualUrl(manual);
    if (manual) setDraft(manual);
    void connect(manual);
  }, [connect]);

  useEffect(() => {
    if (!frameUrl) return;
    timer.current = setTimeout(() => setSlow(true), 10000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [frameUrl]);

  const openInNewTab = async () => {
    // Open synchronously so the popup is not blocked, then point it at a fresh pass.
    const tab = window.open("about:blank", "_blank");
    try {
      const url = manualUrl ?? (await fetchTicketUrl());
      if (tab) tab.location.href = url;
    } catch (cause) {
      tab?.close();
      setError(cause instanceof Error ? cause.message : "CloudCLI 暂时不可用");
    }
  };

  const applyManual = (value: string | null) => {
    const next = value?.trim().replace(/\/$/, "") || null;
    if (next && !isValidUrl(next)) return;
    saveUrl(next);
    setManualUrl(next);
    setShowSettings(false);
    void connect(next);
  };

  return (
    <section className="flex h-[calc(100vh-58px-64px)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-[#0b0c0e]">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <AppWindow size={15} className="text-[#aaa8ff]" />
        <span className="font-mono text-[12px] text-ink">CloudCLI</span>
        <span className="font-mono text-[11px] text-moss/60">· {manualUrl ? `手动地址 ${manualUrl}` : "VPS 远程连接"}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => void connect(manualUrl)}
            aria-label="重新连接"
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink"
          >
            <RotateCw size={13} />
          </button>
          <button
            type="button"
            onClick={() => void openInNewTab()}
            aria-label="在新标签页打开"
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink"
          >
            <ExternalLink size={13} />
          </button>
          <button
            type="button"
            onClick={() => setShowSettings((value) => !value)}
            aria-label="连接设置"
            className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink"
          >
            <Settings2 size={13} />
          </button>
        </div>
      </header>

      {showSettings ? (
        <form
          className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5 text-[11px] text-moss"
          onSubmit={(event) => {
            event.preventDefault();
            applyManual(draft);
          }}
        >
          <span>手动地址（例如 SSH 隧道 http://localhost:3001）：</span>
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="CloudCLI 手动地址"
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-white/[0.02] px-2 font-mono text-[11px] text-ink outline-none focus:border-[#5e6ad2]"
          />
          <button type="submit" className="h-7 rounded-md border border-line px-2.5 hover:text-ink">
            使用手动地址
          </button>
          <button type="button" onClick={() => applyManual(null)} className="h-7 rounded-md border border-line px-2.5 hover:text-ink">
            改回远程连接
          </button>
        </form>
      ) : null}

      {error ? (
        <div className="border-b border-line bg-[#1a1012] px-4 py-2 text-[11px] leading-5 text-[#ff9ca1]">
          连接 CloudCLI 失败：{error}。可以点刷新重试；如果 VPS 刚重启，隧道大约 1 分钟后恢复。
        </div>
      ) : null}
      {slow && !loaded && !error ? (
        <div className="border-b border-line bg-[#15140f] px-4 py-2 text-[11px] leading-5 text-[#e8d9a8]">
          加载有点慢。可以点刷新重试，或点右上角在新标签页打开（Safari 有时不允许在网页里嵌入，新标签页不受影响）。
        </div>
      ) : null}

      {frameUrl ? (
        <iframe
          key={frameUrl}
          src={frameUrl}
          title="CloudCLI"
          onLoad={() => {
            setLoaded(true);
            if (timer.current) clearTimeout(timer.current);
          }}
          allow="clipboard-read; clipboard-write"
          className="min-h-0 w-full flex-1 bg-[#0b0c0e]"
        />
      ) : (
        <div className="grid flex-1 place-items-center font-mono text-[12px] text-moss/60">{error ? "未连接" : "正在连接 CloudCLI…"}</div>
      )}
    </section>
  );
}
