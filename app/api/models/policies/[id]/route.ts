import { fail, ok, parseJson } from "@/lib/api";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body) return fail("Invalid JSON body");

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, id: params.id });

  const { data, error } = await supabase
    .from("model_policies")
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq("id", params.id)
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok(data);
}
