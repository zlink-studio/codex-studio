import { fail, ok, resolveOwnerId } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const agentRunId = searchParams.get("agent_run_id");
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok([]);

  let query = supabase.from("model_runs").select("*").order("created_at", { ascending: false }).limit(100);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (agentRunId) query = query.eq("agent_run_id", agentRunId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}
