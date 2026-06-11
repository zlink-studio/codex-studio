import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { archiveMemory, approveMemory, createMemoryDraft, rejectMemory } from "@/lib/memory/service";
import { memories } from "@/lib/mock-data";
import { createSupabaseServerClient } from "@/lib/supabase";
import type { MemoryScope, MemorySourceType, MemoryType, RiskLevel } from "@/lib/types";

type MemoryBody = {
  owner_id?: string;
  ownerId?: string;
  id?: string;
  title?: string;
  type?: MemoryType;
  scope?: MemoryScope;
  category_id?: string | null;
  categoryId?: string | null;
  client_name?: string | null;
  clientName?: string | null;
  project_id?: string | null;
  projectId?: string | null;
  agent_id?: string | null;
  agentId?: string | null;
  content?: string;
  summary?: string | null;
  tags?: string[];
  importance?: number;
  confidence?: number;
  visibility?: string;
  source_type?: MemorySourceType;
  sourceType?: MemorySourceType;
  source_id?: string | null;
  sourceId?: string | null;
  source_url?: string | null;
  sourceUrl?: string | null;
  created_by?: string | null;
  createdBy?: string | null;
  risk_level?: RiskLevel;
  riskLevel?: RiskLevel;
  action?: "approve" | "reject" | "archive" | "update";
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const scope = searchParams.get("scope");
  const categoryId = searchParams.get("category_id");
  const clientName = searchParams.get("client_name");
  const projectId = searchParams.get("project_id");
  const q = searchParams.get("q")?.toLowerCase();
  const supabase = createSupabaseServerClient();

  if (!supabase) {
    return ok(
      memories
        .filter((memory) => !type || memory.type === type)
        .filter((memory) => !status || (memory.status ?? "approved") === status)
        .filter((memory) => !scope || (memory.scope ?? "global") === scope)
        .filter((memory) => !categoryId || memory.categoryId === categoryId)
        .filter((memory) => !clientName || memory.clientName === clientName)
        .filter((memory) => !projectId || memory.projectId === projectId)
        .filter((memory) => !q || `${memory.title} ${memory.summary ?? ""} ${memory.content} ${memory.tags.join(" ")}`.toLowerCase().includes(q))
    );
  }

  let query = supabase.from("memories").select("*").order("updated_at", { ascending: false }).limit(300);
  if (ownerId) query = query.eq("owner_id", ownerId);
  if (type) query = query.eq("type", type);
  if (status) query = query.eq("status", status);
  if (scope) query = query.eq("scope", scope);
  if (categoryId) query = query.eq("category_id", categoryId);
  if (clientName) query = query.eq("client_name", clientName);
  if (projectId) query = query.eq("project_id", projectId);
  if (q) query = query.or(`title.ilike.%${q}%,content.ilike.%${q}%,summary.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return fail(error.message, 500);
  return ok(data ?? []);
}

export async function POST(request: Request) {
  const body = await parseJson<MemoryBody>(request);
  if (!body?.title || !body?.type || !body?.content) return fail("title, type and content are required");

  const ownerId = resolveOwnerId(body);
  const memory = await createMemoryDraft({
    ownerId,
    title: body.title,
    type: body.type,
    scope: body.scope ?? "global",
    categoryId: body.category_id ?? body.categoryId ?? null,
    clientName: body.client_name ?? body.clientName ?? null,
    projectId: body.project_id ?? body.projectId ?? null,
    agentId: body.agent_id ?? body.agentId ?? null,
    content: body.content,
    summary: body.summary,
    tags: body.tags ?? [],
    importance: body.importance,
    confidence: body.confidence,
    visibility: body.visibility,
    sourceType: body.source_type ?? body.sourceType ?? "manual",
    sourceId: body.source_id ?? body.sourceId ?? null,
    sourceUrl: body.source_url ?? body.sourceUrl ?? null,
    createdBy: body.created_by ?? body.createdBy ?? "owner",
    riskLevel: body.risk_level ?? body.riskLevel
  });

  return ok(memory ?? { ...body, id: crypto.randomUUID() }, { status: 201 });
}

export async function PATCH(request: Request) {
  const body = await parseJson<MemoryBody>(request);
  const memoryId = body?.id;
  if (!memoryId) return fail("memory id is required");

  const ownerId = resolveOwnerId(body);
  if (body.action === "approve") return ok(await approveMemory(memoryId, ownerId));
  if (body.action === "reject") return ok(await rejectMemory(memoryId, ownerId));
  if (body.action === "archive") return ok(await archiveMemory(memoryId, ownerId));

  const supabase = createSupabaseServerClient();
  if (!supabase || !ownerId) return ok({ ...body, updated_at: new Date().toISOString() });

  const patch = {
    title: body.title,
    type: body.type,
    scope: body.scope,
    category_id: body.category_id ?? body.categoryId,
    client_name: body.client_name ?? body.clientName,
    project_id: body.project_id ?? body.projectId,
    agent_id: body.agent_id ?? body.agentId,
    content: body.content,
    summary: body.summary,
    tags: body.tags,
    importance: body.importance,
    confidence: body.confidence,
    visibility: body.visibility,
    source_type: body.source_type ?? body.sourceType,
    source_id: body.source_id ?? body.sourceId,
    source_url: body.source_url ?? body.sourceUrl,
    updated_at: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("memories")
    .update(Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)))
    .eq("id", memoryId)
    .eq("owner_id", ownerId)
    .select("*")
    .single();
  if (error) return fail(error.message, 500);
  await supabase.from("memory_access_logs").insert({ owner_id: ownerId, memory_id: memoryId, access_type: "update" });
  return ok(data);
}
