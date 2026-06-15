import { ok, parseJson, fail } from "@/lib/api";
import { appendCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const rows = await readCollection<any>("project-logs");
  return ok(projectId ? rows.filter((row) => row.project_id === projectId) : rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.project_id || !body?.event_type || !body?.title || !body?.description) {
    return fail("project_id, event_type, title and description are required");
  }
  const row = {
    id: crypto.randomUUID(),
    project_id: String(body.project_id),
    event_type: String(body.event_type),
    title: String(body.title),
    description: String(body.description),
    related_task_id: body.related_task_id ? String(body.related_task_id) : null,
    related_agent_id: body.related_agent_id ? String(body.related_agent_id) : null,
    related_deliverable_id: body.related_deliverable_id ? String(body.related_deliverable_id) : null,
    created_at: new Date().toISOString()
  };
  await appendCollectionItem("project-logs", row);
  return ok(row, { status: 201 });
}
