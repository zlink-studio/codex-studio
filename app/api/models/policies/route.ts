import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { getDefaultModelPolicies } from "@/lib/llm/catalog";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(getDefaultModelPolicies());

  let query = supabase.from("model_policies").select("*").order("name", { ascending: true });
  if (ownerId) query = query.or(`owner_id.is.null,owner_id.eq.${ownerId}`);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  if (!data?.length) return ok(getDefaultModelPolicies());

  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.name || !body?.primary_provider || !body?.primary_model) {
    return fail("name, primary_provider and primary_model are required");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, id: crypto.randomUUID() }, { status: 201 });

  const ownerId = resolveOwnerId(body);
  const { data, error } = await supabase
    .from("model_policies")
    .insert({ ...body, owner_id: ownerId })
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
