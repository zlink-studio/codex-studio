import { fail, ok, resolveOwnerId } from "@/lib/api";
import {
  authorizeCredentialAdmin,
  CredentialAccessError,
  CredentialConfigurationError,
  listCredentialAccessLogs
} from "@/lib/credentials";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    authorizeCredentialAdmin(request);
    const searchParams = new URL(request.url).searchParams;
    const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
    if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
    const requestedLimit = Number(searchParams.get("limit") ?? 100);
    const limit = Number.isFinite(requestedLimit) ? requestedLimit : 100;
    return ok(await listCredentialAccessLogs(ownerId, limit), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof CredentialConfigurationError) return fail(error.message, 503);
    if (error instanceof CredentialAccessError) {
      return fail(error.message, error.message === "Invalid credential admin token." ? 401 : 400);
    }
    return fail(error instanceof Error ? error.message : "Credential audit query failed.", 500);
  }
}
