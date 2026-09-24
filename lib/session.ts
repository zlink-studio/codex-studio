// Owner session for the whole workbench. Edge-compatible (Web Crypto only) so it
// can run in middleware as well as in route handlers.

export const SESSION_COOKIE = "zl_session";
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function getSecret() {
  const secret = process.env.WORKBENCH_SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

export function isAuthConfigured() {
  return Boolean(process.env.WORKBENCH_PASSWORD?.trim() && getSecret());
}

async function hmacHex(secret: string, message: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return Array.from(new Uint8Array(signature), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

// Constant-time comparison of two strings of possibly different length.
export function safeEqual(left: string, right: string) {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let diff = a.length ^ b.length;
  for (let index = 0; index < Math.max(a.length, b.length); index += 1) {
    diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  }
  return diff === 0;
}

export async function createSessionToken() {
  const secret = getSecret();
  if (!secret) throw new Error("WORKBENCH_SESSION_SECRET is not configured (min 32 chars).");
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
  return `${expiresAt}.${await hmacHex(secret, `v1.${expiresAt}`)}`;
}

export async function verifySessionToken(token: string | undefined | null) {
  const secret = getSecret();
  if (!secret || !token) return false;
  const [expiresRaw, signature] = token.split(".");
  const expiresAt = Number(expiresRaw);
  if (!Number.isFinite(expiresAt) || !signature) return false;
  if (expiresAt < Math.floor(Date.now() / 1000)) return false;
  return safeEqual(signature, await hmacHex(secret, `v1.${expiresAt}`));
}
