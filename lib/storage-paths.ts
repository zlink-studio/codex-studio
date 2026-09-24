import path from "path";

// Serverless hosts (Vercel) only allow writes under /tmp, and those files do
// not survive between invocations. Durable data belongs in Supabase; this root
// is for generated drafts and local-store development only.
export function getWritableRoot() {
  if (process.env.ZLINK_DATA_DIR?.trim()) return path.resolve(process.env.ZLINK_DATA_DIR.trim());
  if (process.env.VERCEL) return path.join("/tmp", "zlink");
  return process.cwd();
}

export function getOutputsRoot() {
  return path.join(getWritableRoot(), "outputs");
}

// Resolve a stored deliverable path and refuse anything outside the outputs root.
export function resolveDeliverablePath(stored: string) {
  const root = getOutputsRoot();
  const resolved = path.resolve(root, stored);
  return resolved === root || resolved.startsWith(root + path.sep) ? resolved : null;
}
