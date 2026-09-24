import { fail, ok, parseJson } from "@/lib/api";
import { classifyApproval } from "@/lib/approval-policy";
import { appendCollectionItem, patchCollectionItem, readCollection } from "@/lib/local-store";

export const dynamic = "force-dynamic";

export async function GET() {
  return ok(await readCollection<any>("skills"));
}

export async function POST(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.name || !body?.slug || !body?.category) {
    return fail("name, slug and category are required");
  }

  const skills = await readCollection<any>("skills");
  const slug = String(body.slug);
  if (skills.some((item) => item.slug === slug)) {
    return fail("skill slug already exists", 409);
  }

  const now = new Date().toISOString();
  const enabled = Boolean(body.enabled ?? false);
  const baseRecord = {
    id: crypto.randomUUID(),
    name: String(body.name),
    slug,
    category: String(body.category),
    description: String(body.description ?? ""),
    instructions: String(body.instructions ?? "请补充技能说明与执行边界。"),
    input_schema: body.input_schema ?? body.inputSchema ?? null,
    output_schema: body.output_schema ?? body.outputSchema ?? null,
    risk_level: String(body.risk_level ?? body.riskLevel ?? "low"),
    skill_type: String(body.skill_type ?? body.skillType ?? "knowledge"),
    required_tools: body.required_tools ?? body.requiredTools ?? [],
    required_memory_types: body.required_memory_types ?? body.requiredMemoryTypes ?? [],
    approval_required: Boolean(body.approval_required ?? body.approvalRequired ?? false),
    source: String(body.source ?? "custom"),
    source_url: body.source_url ?? body.sourceUrl ?? null,
    license: body.license ?? "Internal",
    version: body.version ?? "0.1.0",
    enabled,
    install_status: body.install_status ?? (enabled ? "installed" : "draft"),
    installed_at: body.installed_at ?? (enabled ? now : null),
    created_at: now,
    updated_at: now
  };
  const approvalDecision = classifyApproval(baseRecord);
  const record = {
    ...baseRecord,
    approval_level: approvalDecision.level,
    approval_required: baseRecord.approval_required
  };

  await appendCollectionItem<any>("skills", record);

  if (record.approval_required || record.risk_level === "high" || record.risk_level === "critical") {
    const reviews = await readCollection<any>("skill-reviews");
    const exists = reviews.find((item) => item.skill_id === record.id);
    if (!exists) {
      await appendCollectionItem<any>("skill-reviews", {
        id: crypto.randomUUID(),
        skill_id: record.id,
        review_status: "pending",
        risk_notes: "新导入技能已进入审查队列，请主理人确认后再启用。",
        reviewed_by: null,
        reviewed_at: null,
        created_at: now
      });
    }
  }

  return ok(record, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<Record<string, unknown>>(request);
  if (!body?.id || typeof body.id !== "string") return fail("id is required");

  const current = (await readCollection<any>("skills")).find((item) => item.id === body.id);
  if (!current) return fail("skill not found", 404);

  const enabled = typeof body.enabled === "boolean" ? body.enabled : current.enabled;
  const patch: Record<string, unknown> = {
    ...body,
    enabled,
    install_status:
      body.install_status ??
      (enabled ? (current.install_status === "draft" ? "installed" : current.install_status ?? "installed") : "disabled"),
    installed_at: body.installed_at ?? (enabled && !current.installed_at ? new Date().toISOString() : current.installed_at ?? null),
    updated_at: new Date().toISOString()
  };

  const approvalDecision = classifyApproval({ ...current, ...patch });
  Object.assign(patch, {
    approval_level: approvalDecision.level,
    approval_required: Boolean(patch.approval_required ?? current.approval_required)
  });

  const updated = await patchCollectionItem<any>("skills", body.id, patch);
  if (!updated) return fail("skill not found", 404);
  return ok(updated);
}
