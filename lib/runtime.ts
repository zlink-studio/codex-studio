export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDemoDataEnabled() {
  return process.env.NEXT_PUBLIC_ALLOW_DEMO_DATA === "true" || process.env.ALLOW_DEMO_DATA === "true";
}

export function getRuntimeMode() {
  if (isSupabaseConfigured()) return "database";
  if (isDemoDataEnabled()) return "demo";
  return "setup_required";
}

export function setupRequiredPayload(resource: string) {
  return {
    resource,
    mode: "setup_required",
    message: "Supabase is not configured. Add environment variables or enable NEXT_PUBLIC_ALLOW_DEMO_DATA=true for demo mode."
  };
}
