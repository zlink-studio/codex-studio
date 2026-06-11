import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { normalizeAgent, normalizeProject, normalizeTask } from "@/lib/client-normalizers";
import { generateDailyReport } from "@/lib/reporting";
import { createSupabaseServerClient } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await parseJson<{ report_date?: string; owner_id?: string }>(request);
  const reportDate = body?.report_date ?? new Date().toISOString().slice(0, 10);
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return ok({ ...(await generateDailyReport({ reportDate })), persisted: false }, { status: 201 });
  }

  const ownerId = resolveOwnerId(body as Record<string, unknown>);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required when Supabase is configured");

  const [{ data: agentRows, error: agentError }, { data: projectRows, error: projectError }, { data: taskRows, error: taskError }] =
    await Promise.all([
      supabase.from("agents").select("*").eq("owner_id", ownerId),
      supabase.from("projects").select("*, project_agents(agent_id)").eq("owner_id", ownerId),
      supabase.from("tasks").select("*").eq("owner_id", ownerId)
    ]);

  if (agentError) return fail(agentError.message, 500);
  if (projectError) return fail(projectError.message, 500);
  if (taskError) return fail(taskError.message, 500);

  const report = await generateDailyReport({
    reportDate,
    agents: (agentRows ?? []).map(normalizeAgent),
    projects: (projectRows ?? []).map(normalizeProject),
    tasks: (taskRows ?? []).map(normalizeTask)
  });

  const { data, error } = await supabase
    .from("daily_reports")
    .upsert(
      {
        owner_id: ownerId,
        report_date: report.reportDate,
        summary: report.summary,
        wins: report.wins,
        risks: report.risks,
        next_actions: report.nextActions
      },
      { onConflict: "owner_id,report_date" }
    )
    .select("*")
    .single();

  if (error) return fail(error.message, 500);
  return ok({ ...data, persisted: true }, { status: 201 });
}
