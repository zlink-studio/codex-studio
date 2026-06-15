import { fail, ok, parseJson } from "@/lib/api";
import { agents } from "@/lib/mock-data";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export async function GET() {
  return ok(await readCollection<typeof agents[number]>("agents"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.name || !body?.department || !body?.title || !body?.prompt) {
    return fail("name, department, title and prompt are required");
  }

  const record = {
    ...body,
    id: crypto.randomUUID(),
    status: body.status ?? "idle"
  };
  await appendCollectionItem("agents", record as typeof agents[number]);
  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const updated = await patchCollectionItem<typeof agents[number]>("agents", body.id, body as Partial<typeof agents[number]>);
  if (!updated) return fail("agent not found", 404);
  return ok(updated);
}
