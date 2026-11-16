import { ok } from "@/lib/api";
import { isCredentialAdminConfigured, isCredentialEncryptionConfigured } from "@/lib/credentials";
import { isAnthropicConfigured } from "@/lib/llm/anthropic-client";
import { isCodexLocalConfigured } from "@/lib/llm/providers/codex-local";
import { isObsidianVaultConfigured } from "@/lib/obsidian-vault";
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
    credentialEncryption: isCredentialEncryptionConfigured(),
    credentialAdmin: isCredentialAdminConfigured(),
    obsidianVault: isObsidianVaultConfigured(),
    n8nSocial: Boolean(process.env.N8N_TOOL_CONNECTION_ID || process.env.N8N_SOCIAL_WEBHOOK_URL || process.env.N8N_WEBHOOK_URL),
    n8nCallbackSecret: Boolean(process.env.N8N_CALLBACK_SECRET),
    contentSchedulerToken: Boolean(process.env.CONTENT_SCHEDULER_TOKEN),
    contentAdminToken: Boolean(process.env.CONTENT_ADMIN_TOKEN),
    openai: Boolean(process.env.OPENAI_API_KEY),
    anthropic: isAnthropicConfigured(),
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
    CREDENTIAL_ENCRYPTION_KEY: !checks.credentialEncryption,
    CREDENTIAL_ADMIN_TOKEN: !checks.credentialAdmin,
    OBSIDIAN_VAULT_DIR: !checks.obsidianVault,
    N8N_SOCIAL_CONNECTION: !checks.n8nSocial,
    N8N_CALLBACK_SECRET: !checks.n8nCallbackSecret,
    CONTENT_SCHEDULER_TOKEN: !checks.contentSchedulerToken,
    CONTENT_ADMIN_TOKEN: !checks.contentAdminToken,
    OPENAI_API_KEY_OR_CODEX_LOCAL: !checks.openai && !checks.codexLocal && !checks.manualBridge && !checks.anthropic
  })
    .filter(([, value]) => value)
    .map(([key]) => key);

  return ok({
    mode: getRuntimeMode(),
    checks,
    database,
    missing,
    readyForRealUse:
      !checks.demoData &&
      isSupabaseConfigured() &&
      checks.demoOwnerId &&
      checks.credentialEncryption &&
      checks.credentialAdmin &&
      checks.obsidianVault &&
      checks.n8nSocial &&
      checks.n8nCallbackSecret &&
      checks.contentSchedulerToken &&
      checks.contentAdminToken &&
      (checks.openai || checks.codexLocal || checks.manualBridge || checks.anthropic) &&
      database.connected
  });
}
