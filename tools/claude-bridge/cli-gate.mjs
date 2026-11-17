// CloudCLI gate: an authenticating reverse proxy in front of CloudCLI so it can be
// reached through a Cloudflare quick tunnel without exposing it to the internet.
//
// Only browsers that arrive with a ticket signed by ZLink OS get in:
//   OS (owner logged in) -> /api/cli-ticket -> https://<tunnel>/__zl_gate?t=<ticket>
// The ticket is valid for 2 minutes and once only; the gate then sets a signed
// cookie (7 days) and proxies HTTP + WebSocket traffic to CloudCLI on 127.0.0.1.
// CloudCLI's own username/password login still applies behind this gate.

import { createHmac, timingSafeEqual } from "node:crypto";
import { readFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(path.join(here, "bridge.env"), "utf8")
    .split("\n")
    .map((line) => line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2]])
);

const SECRET = env.CLI_GATE_SECRET || "";
const PORT = Number(env.CLI_GATE_PORT || 18444);
const TARGET_HOST = "127.0.0.1";
const TARGET_PORT = Number(env.CLOUDCLI_PORT || 3001);
const COOKIE = "zl_cli";
const COOKIE_TTL = 7 * 24 * 3600;
const TICKET_TTL = 120;

if (SECRET.length < 32) {
  console.error("CLI_GATE_SECRET missing or too short in bridge.env");
  process.exit(1);
}

const usedTickets = new Map();

function sign(kind, expiresAt) {
  return createHmac("sha256", SECRET).update(`${kind}.${expiresAt}`).digest("hex");
}

function verify(kind, token, maxTtl) {
  const [expRaw, signature] = String(token || "").split(".");
  const expiresAt = Number(expRaw);
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isInteger(expiresAt) || !signature || expiresAt < now || expiresAt > now + maxTtl) return false;
  const expected = Buffer.from(sign(kind, expiresAt));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

function cookieValue(req) {
  for (const part of String(req.headers.cookie || "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === COOKIE) return rest.join("=");
  }
  return null;
}

function allowed(req) {
  return verify("cookie", cookieValue(req), COOKIE_TTL);
}

function deny(res) {
  res.writeHead(403, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end('<!doctype html><meta charset="utf-8"><title>ZLink</title><body style="font:14px system-ui;background:#0b0c0e;color:#ddd;padding:40px">请从 ZLink OS 的「Claude 控制台」打开 CloudCLI。</body>');
}

function log(req, status) {
  console.log(`${new Date().toISOString()} ${req.headers["cf-connecting-ip"] || req.socket.remoteAddress} ${req.method} ${req.url.split("?")[0]} ${status}`);
}

function handleGate(req, res, url) {
  const ticket = url.searchParams.get("t");
  const now = Math.floor(Date.now() / 1000);
  for (const [key, exp] of usedTickets) if (exp < now) usedTickets.delete(key);
  if (!verify("ticket", ticket, TICKET_TTL) || usedTickets.has(ticket)) {
    log(req, 403);
    return deny(res);
  }
  usedTickets.set(ticket, now + TICKET_TTL);
  const expiresAt = now + COOKIE_TTL;
  res.writeHead(302, {
    location: "/",
    "cache-control": "no-store",
    // SameSite=None + Partitioned so it also works inside the OS iframe.
    "set-cookie": `${COOKIE}=${expiresAt}.${sign("cookie", expiresAt)}; Path=/; Max-Age=${COOKIE_TTL}; HttpOnly; Secure; SameSite=None; Partitioned`
  });
  res.end();
  log(req, 302);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://gate");
  if (url.pathname === "/__zl_gate") return handleGate(req, res, url);
  // Public static files the browser fetches without credentials (service worker, manifest).
  const publicFile = req.method === "GET" && ["/sw.js", "/manifest.json"].includes(url.pathname);
  if (!publicFile && !allowed(req)) {
    log(req, 403);
    return deny(res);
  }

  const upstream = http.request(
    { host: TARGET_HOST, port: TARGET_PORT, method: req.method, path: req.url, headers: { ...req.headers, host: `localhost:${TARGET_PORT}` } },
    (upstreamRes) => {
      res.writeHead(upstreamRes.statusCode || 502, upstreamRes.headers);
      upstreamRes.pipe(res);
    }
  );
  upstream.on("error", () => {
    if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain; charset=utf-8" });
    res.end("CloudCLI is not responding on the VPS.");
  });
  req.pipe(upstream);
});

// WebSocket (and any other upgrade): check the cookie, then splice raw sockets.
server.on("upgrade", (req, socket, head) => {
  if (!allowed(req)) {
    log(req, 403);
    socket.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    return;
  }
  const upstream = net.connect(TARGET_PORT, TARGET_HOST, () => {
    const headers = { ...req.headers, host: `localhost:${TARGET_PORT}` };
    const lines = [`${req.method} ${req.url} HTTP/1.1`, ...Object.entries(headers).flatMap(([key, value]) =>
      (Array.isArray(value) ? value : [value]).map((item) => `${key}: ${item}`)
    )];
    upstream.write(`${lines.join("\r\n")}\r\n\r\n`);
    if (head?.length) upstream.write(head);
    upstream.pipe(socket);
    socket.pipe(upstream);
  });
  const close = () => {
    upstream.destroy();
    socket.destroy();
  };
  upstream.on("error", close);
  socket.on("error", close);
});

server.listen(PORT, "127.0.0.1", () => console.log(`[cli-gate] listening on 127.0.0.1:${PORT} -> ${TARGET_HOST}:${TARGET_PORT}`));
