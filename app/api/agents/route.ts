import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { agents } from "@/lib/mock-data";
import { isDemoDataEnabled, setupRequiredPayload } from "@/lib/runtime";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(isDemoDataEnabled() ? agents : []);

  const { data, error } = await supabase.from("agents").select("*").order("created_at", { ascending: false });
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.name || !body?.department || !body?.title || !body?.prompt) {
    return fail("name, department, title and prompt are required");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) {
    if (isDemoDataEnabled()) return ok({ ...body, id: crypto.randomUUID(), status: body.status ?? "idle" }, { status: 201 });
    return fail(setupRequiredPayload("agents").message, 503);
  }

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data, error } = await supabase.from("agents").insert({ ...body, owner_id: ownerId }).select("*").single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
