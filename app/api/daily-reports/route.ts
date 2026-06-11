import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { dailyReport } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function GET() {
  const supabase = createSupabaseServerClient();
  if (!supabase) return ok(dailyReport);

  const { data, error } = await supabase.from("daily_reports").select("*").order("report_date", { ascending: false }).limit(7);
  if (error) return fail(error.message, 500);
  return ok(data);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.report_date || !body?.summary) {
    return fail("report_date and summary are required");
  }

  const supabase = createSupabaseServerClient();
  if (!supabase) return ok({ ...body, id: crypto.randomUUID() }, { status: 201 });

  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const { data, error } = await supabase
    .from("daily_reports")
    .upsert({ ...body, owner_id: ownerId }, { onConflict: "owner_id,report_date" })
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  return ok(data, { status: 201 });
}
