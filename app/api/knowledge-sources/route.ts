import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { knowledgeSources } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

type SourceBody = {
  owner_id?: string;
  ownerId?: string;
  id?: string;
  name?: string;
  type?: string;
  source_url?: string | null;
  sourceUrl?: string | null;
  sync_mode?: string;
  syncMode?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

export async function GET(request: Request) {
  const ownerId = resolveOwnerId(Object.fromEntries(new URL(request.url).searchParams.entries()));
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(knowledgeSources);

  let query = supabase.from("knowledge_sources").select("*").order("updated_at", { ascending: false }).limit(100);
  if (ownerId) query = query.or(`owner_id.is.null,owner_id.eq.${ownerId}`);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await parseJson<SourceBody>(request);
  if (!body?.name || !body?.type) return fail("name and type are required");

  const ownerId = resolveOwnerId(body);
  const payload = {
    owner_id: ownerId,
    name: body.name,
    type: body.type,
    source_url: body.source_url ?? body.sourceUrl ?? null,
    sync_mode: body.sync_mode ?? body.syncMode ?? "manual",
    status: body.status ?? "active",
    metadata: body.metadata ?? {}
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...payload, id: crypto.randomUUID(), created_at: new Date().toISOString() }, { status: 201 });

  const { data, error } = await supabase.from("knowledge_sources").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
