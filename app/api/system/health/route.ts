import { ok } from "@/lib/api";
import { isCodexLocalConfigured } from "@/lib/llm/providers/codex-local";
import { getRuntimeMode, isDemoDataEnabled, isSupabaseConfigured } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createSupabaseServerClient();
  const checks = {
    supabaseUrl: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabaseServiceRole: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    supabaseAnonKey: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    demoOwnerId: Boolean(process.env.DEMO_OWNER_ID),
    openai: Boolean(process.env.OPENAI_API_KEY),
    codexLocal: isCodexLocalConfigured(),
    manualBridge: process.env.LLM_NO_KEY_MODE === "manual_bridge",
    demoData: isDemoDataEnabled()
  };

  let database: { connected: boolean; error?: string; ownerReady?: boolean } = { connected: false };
  if (supabase && process.env.DEMO_OWNER_ID) {
    const { error } = await supabase.from("users").select("id").eq("id", process.env.DEMO_OWNER_ID).maybeSingle();
    database = { connected: !error, ownerReady: !error, error: error?.message };
  } else if (supabase) {
    const { error } = await supabase.from("users").select("id").limit(1);
    database = { connected: !error, ownerReady: false, error: error?.message };
  }

  const missing = Object.entries({
    NEXT_PUBLIC_SUPABASE_URL: !checks.supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: !checks.supabaseServiceRole,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: !checks.supabaseAnonKey,
    DEMO_OWNER_ID: !checks.demoOwnerId,
    OPENAI_API_KEY_OR_CODEX_LOCAL: !checks.openai && !checks.codexLocal && !checks.manualBridge
  })
    .filter(([, value]) => value)
    .map(([key]) => key);

  return ok({
    mode: getRuntimeMode(),
    checks,
    database,
    missing,
    readyForRealUse: isSupabaseConfigured() && checks.demoOwnerId && (checks.openai || checks.codexLocal || checks.manualBridge) && database.connected
  });
}
