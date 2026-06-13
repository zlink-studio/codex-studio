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

  const rows = data
    .filter((row) => !String(row.model ?? "").includes("placeholder"))
    .map((row) => {
    const seed = modelCatalogSeeds.find((item) => item.provider === row.provider && item.model === row.model);
    if (!seed) return row;

    return {
      ...row,
      display_name: seed.displayName,
      context_window: seed.contextWindow,
      input_cost_per_1m: seed.inputCostPer1m,
      output_cost_per_1m: seed.outputCostPer1m,
      capabilities: seed.capabilities,
      recommended_use: seed.recommendedUse,
      enabled: seed.enabled,
      notes: seed.notes
    };
  });

  const merged = [
    ...rows,
    ...modelCatalogSeeds.filter((seed) => !rows.some((row) => row.provider === seed.provider && row.model === seed.model))
  ].sort((a, b) => `${a.provider}:${a.model}`.localeCompare(`${b.provider}:${b.model}`));

  return ok(merged);
}
