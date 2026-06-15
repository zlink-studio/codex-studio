import { ok, parseJson, fail } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("project_id");
  const taskId = searchParams.get("task_id");
  let rows = await readCollection<any>("deliverables");
  if (projectId) rows = rows.filter((row) => row.project_id === projectId);
  if (taskId) rows = rows.filter((row) => row.task_id === taskId);
  return ok(rows);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.project_id || !body?.title || !body?.type) {
    return fail("project_id, title and type are required");
  }
  const now = new Date().toISOString();
  const row = {
    id: crypto.randomUUID(),
    project_id: String(body.project_id),
    task_id: body.task_id ? String(body.task_id) : null,
    agent_id: body.agent_id ? String(body.agent_id) : null,
    title: String(body.title),
    type: String(body.type),
    file_path: body.file_path ? String(body.file_path) : null,
    content: body.content ? String(body.content) : null,
    status: String(body.status ?? "draft"),
    created_at: now,
    updated_at: now
  };
  await appendCollectionItem("deliverables", row);
  return ok(row, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id) return fail("id is required");
  const row = await patchCollectionItem<any>("deliverables", String(body.id), {
    ...body,
    updated_at: new Date().toISOString()
  });
  if (!row) return fail("deliverable not found", 404);
  return ok(row);
}
