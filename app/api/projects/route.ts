import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, readCollection } from "@/lib/local-store";
import { syncProjectState } from "@/lib/workflow-engine";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const projects = await readCollection<any>("projects");
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  if (!refresh) return ok(projects);
  const refreshed = await Promise.all(
    projects.map(async (project) => (await syncProjectState(project.id)) ?? project)
  );
  return ok(refreshed);
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.name || !body?.client_name || !body?.objective) {
    return fail("name, client_name and objective are required");
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    name: String(body.name),
    client_name: String(body.client_name),
    objective: String(body.objective),
    client_profile: String(body.client_profile ?? ""),
    brief: body.brief ? String(body.brief) : null,
    progress: 0,
    stage: String(body.stage ?? "planning"),
    risk_level: String(body.risk_level ?? "low"),
    due_date: body.due_date ? String(body.due_date) : null,
    agent_ids: Array.isArray(body.agent_ids) ? body.agent_ids : [],
    created_at: now,
    updated_at: now
  };
  await appendCollectionItem("projects", record);
  return ok(record, { status: 201 });
}
