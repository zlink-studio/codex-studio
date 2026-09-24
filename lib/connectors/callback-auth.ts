import { createHmac, timingSafeEqual } from "node:crypto";

export function verifyN8nCallbackSignature(rawBody: string, providedSignature: string | null) {
  const secret = process.env.N8N_CALLBACK_SECRET?.trim();
  if (!secret) throw new Error("N8N_CALLBACK_SECRET is not configured.");
  const provided = (providedSignature ?? "").replace(/^sha256=/i, "").trim();
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && timingSafeEqual(expectedBuffer, providedBuffer);
}
