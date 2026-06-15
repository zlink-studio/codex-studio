import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await readCollection<any>("skill-runs"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.skill_id || !body?.status) {
    return fail("skill_id and status are required");
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    skill_id: body.skill_id,
    agent_id: body.agent_id ?? null,
    task_id: body.task_id ?? null,
    agent_run_id: body.agent_run_id ?? null,
    model_run_id: body.model_run_id ?? null,
    status: body.status,
    input: body.input ?? null,
    output: body.output ?? null,
    error: body.error ?? null,
    latency_ms: body.latency_ms ?? null,
    created_at: now
  };
  await appendCollectionItem<any>("skill-runs", record);

  if (body.skill_id) {
    await patchCollectionItem<any>("skills", String(body.skill_id), {
      last_run_at: now,
      updated_at: now
    });
  }

  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const updated = await patchCollectionItem<any>("skill-runs", body.id, body as Record<string, unknown>);
  if (!updated) return fail("skill run not found", 404);
  return ok(updated);
}
