import { NextResponse } from "next/server";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json({ data }, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}

export function resolveOwnerId(body?: Record<string, unknown> | null) {
  const candidate = body?.owner_id ?? body?.ownerId ?? process.env.DEMO_OWNER_ID;
  return typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : null;
}

export function cleanEmptyRelations<T extends Record<string, unknown>>(body: T, keys: string[]) {
  return keys.reduce<Record<string, unknown>>(
    (payload, key) => ({
      ...payload,
      [key]: payload[key] === "" ? null : payload[key]
    }),
    { ...body }
  );
}
