import { fail, ok, resolveOwnerId } from "@/lib/api";
import { memoryAccessLogs } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const memoryId = searchParams.get("memory_id");
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(memoryId ? memoryAccessLogs.filter((log) => log.memoryId === memoryId) : memoryAccessLogs);

  let query = supabase
    .from("memory_access_logs")
    .select("*, memory:memories(title), agent:agents(name), task:tasks(title)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (ownerId) query = query.eq("owner_id", ownerId);
  if (memoryId) query = query.eq("memory_id", memoryId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}
