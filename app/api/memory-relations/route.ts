import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { memoryRelations } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

type RelationBody = {
  owner_id?: string;
  ownerId?: string;
  memory_id?: string;
  memoryId?: string;
  related_type?: string;
  relatedType?: string;
  related_id?: string;
  relatedId?: string;
  relation_type?: string;
  relationType?: string;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const memoryId = searchParams.get("memory_id");
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(memoryId ? memoryRelations.filter((relation) => relation.memoryId === memoryId) : memoryRelations);

  let query = supabase.from("memory_relations").select("*").order("created_at", { ascending: false }).limit(100);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (memoryId) query = query.eq("memory_id", memoryId);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await parseJson<RelationBody>(request);
  const memoryId = body?.memory_id ?? body?.memoryId;
  const relatedType = body?.related_type ?? body?.relatedType;
  const relatedId = body?.related_id ?? body?.relatedId;
  const relationType = body?.relation_type ?? body?.relationType;
  if (!memoryId || !relatedType || !relatedId || !relationType) {
    return fail("memory_id, related_type, related_id and relation_type are required");
  }

  const ownerId = resolveOwnerId(body);
  const payload = {
    owner_id: ownerId,
    memory_id: memoryId,
    related_type: relatedType,
    related_id: relatedId,
    relation_type: relationType
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }, { status: 201 });

  const { data, error } = await supabase.from("memory_relations").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
