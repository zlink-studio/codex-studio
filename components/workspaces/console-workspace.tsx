"use client";

import { useEffect, useRef, useState } from "react";
import { AppWindow, ExternalLink, RotateCw } from "lucide-react";

// Embeds CloudCLI (Claude Code web UI running on the VPS). Until a domain with
// Cloudflare Access is set up, CloudCLI is only reachable through the owner's SSH
// tunnel, so the default address is the Mac's forwarded port. The address is
// configurable per browser and via NEXT_PUBLIC_CLOUDCLI_URL.

const STORAGE_KEY = "zl-cloudcli-url";
const DEFAULT_URL = process.env.NEXT_PUBLIC_CLOUDCLI_URL || "http://localhost:3001";

function readSavedUrl() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
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

export function ConsoleWorkspace() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [draft, setDraft] = useState(DEFAULT_URL);
  const [frameKey, setFrameKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = readSavedUrl();
    if (saved && isValidUrl(saved)) {
      setUrl(saved);
      setDraft(saved);
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    setSlow(false);
    timer.current = setTimeout(() => setSlow(true), 8000);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [url, frameKey]);

  const apply = () => {
    const next = draft.trim().replace(/\/$/, "");
    if (!isValidUrl(next)) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // storage blocked: the address still applies for this visit
    }
    setUrl(next);
    setFrameKey((value) => value + 1);
  };

  return (
    <section className="flex h-[calc(100vh-58px-64px)] min-h-[520px] flex-col overflow-hidden rounded-xl border border-line bg-[#0b0c0e]">
      <header className="flex flex-wrap items-center gap-2 border-b border-line px-4 py-2.5">
        <AppWindow size={15} className="text-[#aaa8ff]" />
        <span className="font-mono text-[12px] text-ink">CloudCLI</span>
        <span className="font-mono text-[11px] text-moss/60">· VPS Claude Code</span>
        <form
          className="ml-auto flex min-w-0 flex-1 items-center gap-2 sm:max-w-md"
          onSubmit={(event) => {
            event.preventDefault();
            apply();
          }}
        >
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            aria-label="CloudCLI 地址"
            className="h-7 min-w-0 flex-1 rounded-md border border-line bg-white/[0.02] px-2 font-mono text-[11px] text-ink outline-none focus:border-[#5e6ad2]"
          />
          <button type="submit" className="h-7 rounded-md border border-line px-2.5 text-[11px] text-moss hover:text-ink">
            连接
          </button>
        </form>
        <button
          type="button"
          onClick={() => setFrameKey((value) => value + 1)}
          aria-label="刷新"
          className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink"
        >
          <RotateCw size={13} />
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label="在新标签页打开"
          className="grid h-7 w-7 place-items-center rounded-md border border-line text-moss hover:text-ink"
        >
          <ExternalLink size={13} />
        </a>
      </header>

      {slow && !loaded ? (
        <div className="border-b border-line bg-[#15140f] px-4 py-2 text-[11px] leading-5 text-[#e8d9a8]">
          还没连上 CloudCLI。请确认：① Mac 上连接 VPS 的 SSH 隧道开着（把 VPS 的 3001 端口转到本机）；② 地址和隧道的本地端口一致。
          Safari 可能不允许在网页里嵌入 localhost，可以点右上角在新标签页打开，或用 Chrome。
        </div>
      ) : null}

      <iframe
        key={`${url}#${frameKey}`}
        src={url}
        title="CloudCLI"
        onLoad={() => {
          setLoaded(true);
          if (timer.current) clearTimeout(timer.current);
        }}
        allow="clipboard-read; clipboard-write"
        className="min-h-0 w-full flex-1 bg-[#0b0c0e]"
      />
    </section>
  );
}
