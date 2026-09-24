import { timingSafeEqual } from "node:crypto";

export class ContentAuthenticationError extends Error {
  constructor(message: string, public readonly status: 401 | 503) {
    super(message);
  }
}

export function authorizeContentAdmin(request: Request) {
  const expected = process.env.CONTENT_ADMIN_TOKEN?.trim();
  if (!expected) throw new ContentAuthenticationError("CONTENT_ADMIN_TOKEN is not configured.", 503);
  const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new ContentAuthenticationError("Invalid content admin token.", 401);
  }
}
