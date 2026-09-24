"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password })
    });
    if (response.ok) {
      const next = searchParams.get("next");
      // Only allow same-site relative redirects.
      window.location.href = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
      return;
    }
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;
    setError(payload?.error ?? "登录失败");
    setPending(false);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4 rounded-xl border border-line bg-[#0b0c0e] p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#e9e5dd] text-[12px] font-bold text-[#19191c]">ZL</span>
        <div>
          <strong className="block text-sm font-semibold">ZLink Studio OS</strong>
          <small className="block text-xs text-moss/60">请输入工作台密码</small>
        </div>
      </div>
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="w-full rounded-lg border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-moss/60"
        placeholder="密码"
      />
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
      <button
        type="submit"
        disabled={pending || !password}
        className="w-full rounded-lg bg-[#e9e5dd] px-3 py-2 text-sm font-semibold text-[#19191c] disabled:opacity-50"
      >
        {pending ? "登录中…" : "登录"}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-paper px-4 text-ink">
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
