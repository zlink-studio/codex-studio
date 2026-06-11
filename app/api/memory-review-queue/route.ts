import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { approveMemory, rejectMemory } from "@/lib/memory/service";
import { createSupabaseServerClient } from "@/lib/supabase";

type QueuePatchBody = {
  owner_id?: string;
  ownerId?: string;
  id?: string;
  memory_id?: string;
  memoryId?: string;
  action?: "approve" | "reject";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? "pending";
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok([]);

  let query = supabase
    .from("memory_review_queue")
    .select("*, memory:memories(*)")
    .order("created_at", { ascending: false })
    .limit(100);

  if (ownerId) query = query.eq("owner_id", ownerId);
  if (status !== "all") query = query.eq("review_status", status);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function PATCH(request: Request) {
  const body = await parseJson<QueuePatchBody>(request);
  const ownerId = resolveOwnerId(body);
  const supabase = createSupabaseServerClient();
  if (!body?.action) return fail("action is required");

  let memoryId = body.memory_id ?? body.memoryId ?? null;
  if (!memoryId && body.id && supabase) {
    const { data, error } = await supabase.from("memory_review_queue").select("memory_id").eq("id", body.id).maybeSingle();
    if (error) return fail(error.message, 500);
    memoryId = data?.memory_id ?? null;
  }

  if (!memoryId) return fail("memory id is required");
  if (body.action === "approve") return ok(await approveMemory(memoryId, ownerId));
  if (body.action === "reject") return ok(await rejectMemory(memoryId, ownerId));
  return fail("unsupported action");
}
