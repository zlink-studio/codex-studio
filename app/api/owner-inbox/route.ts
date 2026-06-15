import { ok, fail } from "@/lib/api";
import { getOwnerInbox } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return ok(await getOwnerInbox());
  } catch (error) {
    return fail(error instanceof Error ? error.message : "failed to load owner inbox", 500);
  }
}
