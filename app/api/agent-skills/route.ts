import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await readCollection<any>("agent-skills"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.agent_id || !body?.skill_id || !body?.priority) {
    return fail("agent_id, skill_id and priority are required");
  }

  const rows = await readCollection<any>("agent-skills");
  const exists = rows.find((item) => item.agent_id === body.agent_id && item.skill_id === body.skill_id);
  if (exists) {
    const updated = await patchCollectionItem<any>("agent-skills", exists.id, {
      priority: body.priority,
      enabled: body.enabled ?? true,
      updated_at: new Date().toISOString()
    });
    return ok(updated);
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    agent_id: body.agent_id,
    skill_id: body.skill_id,
    priority: body.priority,
    enabled: body.enabled ?? true,
    config: body.config ?? null,
    created_at: now,
    updated_at: now
  };
  await appendCollectionItem<any>("agent-skills", record);
  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const updated = await patchCollectionItem<any>("agent-skills", body.id, {
    ...body,
    updated_at: new Date().toISOString()
  });
  if (!updated) return fail("agent skill not found", 404);
  return ok(updated);
}
