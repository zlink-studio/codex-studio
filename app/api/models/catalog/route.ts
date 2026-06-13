import { fail, ok } from "@/lib/api";
import { modelCatalogSeeds } from "@/lib/llm/catalog";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(modelCatalogSeeds);

  const { data, error } = await supabase.from("model_catalog").select("*").order("provider", { ascending: true }).order("model", { ascending: true });
  if (error) return fail(error.message, 500);
  if (!data?.length) return ok(modelCatalogSeeds);

  const merged = [
    ...data,
    ...modelCatalogSeeds.filter((seed) => !data.some((row) => row.provider === seed.provider && row.model === seed.model))
  ].sort((a, b) => `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`));

  return ok(merged);
}
