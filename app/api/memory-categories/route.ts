import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { memoryCategories } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

type CategoryBody = {
  owner_id?: string;
  ownerId?: string;
  id?: string;
  name?: string;
  type?: string;
  parent_id?: string | null;
  parentId?: string | null;
  description?: string | null;
  sort_order?: number;
  sortOrder?: number;
};

export async function GET(request: Request) {
  const ownerId = resolveOwnerId(Object.fromEntries(new URL(request.url).searchParams.entries()));
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(memoryCategories);

  let query = supabase.from("memory_categories").select("*").order("sort_order", { ascending: true });
  if (ownerId) query = query.or(`owner_id.is.null,owner_id.eq.${ownerId}`);
  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await parseJson<CategoryBody>(request);
  if (!body?.name || !body?.type) return fail("name and type are required");

  const ownerId = resolveOwnerId(body);
  const payload = {
    owner_id: ownerId,
    name: body.name,
    type: body.type,
    parent_id: body.parent_id ?? body.parentId ?? null,
    description: body.description ?? null,
    sort_order: body.sort_order ?? body.sortOrder ?? 0
  };

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...payload, id: crypto.randomUUID() }, { status: 201 });

  const { data, error } = await supabase.from("memory_categories").insert(payload).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
