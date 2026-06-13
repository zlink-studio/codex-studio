import { fail, ok } from "@/lib/api";
import { getDefaultModelProviders, getProviderStatus } from "@/lib/llm/catalog";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(getDefaultModelProviders());

  const { data, error } = await supabase.from("model_providers").select("*").order("name", { ascending: true });
  if (error) return fail(error.message, 500);

  const defaults = getDefaultModelProviders();
  if (!data?.length) return ok(defaults);

  const rows = data.map((provider) => ({
      id: provider.id,
      name: provider.name,
      displayName: provider.display_name ?? provider.name,
      baseUrl: provider.base_url,
      apiKeyEnv: provider.api_key_env,
      enabled: provider.enabled,
      status: getProviderStatus(provider.name, provider.enabled),
      notes: provider.notes,
      lastCheckedAt: provider.last_checked_at,
      createdAt: provider.created_at,
      updatedAt: provider.updated_at
    }));

  const merged = [
    ...rows,
    ...defaults.filter((seed) => !rows.some((row) => row.name === seed.name))
  ].sort((a, b) => a.name.localeCompare(b.name));

  return ok(merged);
}
