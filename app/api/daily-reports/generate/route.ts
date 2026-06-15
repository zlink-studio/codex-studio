import { fail, ok, parseJson } from "@/lib/api";
import { normalizeAgent, normalizeProject, normalizeTask } from "@/lib/client-normalizers";
import { readCollection, upsertByField } from "@/lib/local-store";
import { generateDailyReport } from "@/lib/reporting";

export async function POST(request: Request) {
  const body = await parseJson<{ report_date?: string }>(request);
  const reportDate = body?.report_date ?? new Date().toISOString().slice(0, 10);

  const [agentRows, projectRows, taskRows] = await Promise.all([
    readCollection<any>("agents"),
    readCollection<any>("projects"),
    readCollection<any>("tasks")
  ]);

  const report = await generateDailyReport({
    reportDate,
    agents: agentRows.map(normalizeAgent),
    projects: projectRows.map(normalizeProject),
    tasks: taskRows.map(normalizeTask)
  });

  const saved = {
    id: `report-${report.reportDate}`,
    report_date: report.reportDate,
    summary: report.summary,
    wins: report.wins,
    risks: report.risks,
    next_actions: report.nextActions
  };
  await upsertByField("daily-reports", "report_date", report.reportDate, saved);

  return ok({ ...saved, persisted: true }, { status: 201 });
}
