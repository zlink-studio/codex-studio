import { NextResponse } from "next/server";
import { fail, parseJson } from "@/lib/api";
import { createSessionToken, isAuthConfigured, safeEqual, SESSION_COOKIE, SESSION_TTL_SECONDS } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!isAuthConfigured()) return fail("Workbench login is not configured.", 503);

  const body = await parseJson<{ password?: string }>(request);
  const expected = process.env.WORKBENCH_PASSWORD!.trim();
  const valid = typeof body?.password === "string" && safeEqual(body.password, expected);

  if (!valid) {
    // Slow down guessing.
    await new Promise((resolve) => setTimeout(resolve, 800));
    return fail("密码不正确", 401);
  }

  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ data: { ok: true } });
  response.cookies.set(SESSION_COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
  return response;
}
