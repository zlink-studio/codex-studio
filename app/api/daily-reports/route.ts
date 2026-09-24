import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await readCollection<any>("daily-reports");
  return ok(rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.report_date || !body?.summary) {
    return fail("report_date and summary are required");
  }

  const record = {
    id: crypto.randomUUID(),
    report_date: body.report_date,
    summary: body.summary,
    wins: body.wins ?? [],
    risks: body.risks ?? [],
    next_actions: body.next_actions ?? [],
    content_metrics: body.content_metrics ?? {}
  };
  await appendCollectionItem("daily-reports", record);
  return ok(record, { status: 201 });
}
