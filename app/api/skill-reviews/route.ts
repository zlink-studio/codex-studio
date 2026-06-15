import { fail, ok, parseJson } from "@/lib/api";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await readCollection<any>("skill-reviews"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.skill_id || !body?.review_status) {
    return fail("skill_id and review_status are required");
  }

  const now = new Date().toISOString();
  const record = {
    id: crypto.randomUUID(),
    skill_id: body.skill_id,
    review_status: body.review_status,
    risk_notes: body.risk_notes ?? body.riskNotes ?? null,
    reviewed_by: body.reviewed_by ?? body.reviewedBy ?? null,
    reviewed_at: body.review_status === "pending" ? null : now,
    created_at: now
  };
  await appendCollectionItem<any>("skill-reviews", record);
  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const updated = await patchCollectionItem<any>("skill-reviews", body.id, {
    ...body,
    reviewed_at: body.review_status === "pending" ? null : new Date().toISOString()
  });
  if (!updated) return fail("skill review not found", 404);

  if (updated.skill_id) {
    const enableSkill = updated.review_status === "approved";
    await patchCollectionItem<any>("skills", String(updated.skill_id), {
      enabled: enableSkill ? true : undefined,
      install_status: updated.review_status === "approved" ? "installed" : updated.review_status === "rejected" ? "rejected" : "review",
      updated_at: new Date().toISOString()
    });
  }

  return ok(updated);
}
