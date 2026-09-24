import { fail, ok, parseJson } from "@/lib/api";
import { normalizeAgent, normalizeProject, normalizeTask } from "@/lib/client-normalizers";
import { readCollection, upsertByField } from "@/lib/local-store";
import { generateDailyReport } from "@/lib/reporting";
import { getContentOperationsMetrics } from "@/lib/content-metrics";

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
  const contentMetrics = process.env.DEMO_OWNER_ID
    ? await getContentOperationsMetrics(process.env.DEMO_OWNER_ID, 28)
    : null;
  const wins = [
    ...report.wins,
    ...(contentMetrics?.published ? [`近 28 天已发布 ${contentMetrics.published} 条社媒内容，连续日更 ${contentMetrics.currentDailyStreak} 天。`] : [])
  ];
  const risks = [
    ...report.risks,
    ...(contentMetrics?.pendingApproval ? [`有 ${contentMetrics.pendingApproval} 条客户账号内容等待 L2 审批。`] : []),
    ...(contentMetrics?.failed ? [`近 28 天有 ${contentMetrics.failed} 条内容生成或发布失败。`] : [])
  ];
  const nextActions = [
    ...report.nextActions,
    ...(!contentMetrics?.interventionTargetMet ? ["社媒日均人工介入超过 30 分钟，需要排查审批或发布阻塞。"] : [])
  ];

  const saved = {
    id: `report-${report.reportDate}`,
    report_date: report.reportDate,
    summary: report.summary,
    wins,
    risks,
    next_actions: nextActions,
    content_metrics: contentMetrics ?? {}
  };
  await upsertByField("daily-reports", "report_date", report.reportDate, saved);

  return ok({ ...saved, persisted: true }, { status: 201 });
}
