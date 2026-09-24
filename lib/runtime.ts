export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function isDemoDataEnabled() {
  return process.env.USE_LOCAL_STORE === "true";
}

export function getRuntimeMode() {
  if (isDemoDataEnabled()) return "demo";
  if (isSupabaseConfigured()) return "database";
  return "setup_required";
}

export function setupRequiredPayload(resource: string) {
  return {
    resource,
    mode: "setup_required",
    message: "Supabase is not configured. Add environment variables or explicitly set USE_LOCAL_STORE=true for offline development."
  };
}
