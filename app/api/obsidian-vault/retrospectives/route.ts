import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { ObsidianVaultConfigurationError, writeRetrospectiveDraft } from "@/lib/obsidian-vault";

export const dynamic = "force-dynamic";

type RetrospectiveBody = {
  owner_id?: string;
  ownerId?: string;
  title?: string;
  content?: string;
  project_id?: string | null;
  projectId?: string | null;
  task_id?: string | null;
  taskId?: string | null;
  agent_id?: string | null;
  agentId?: string | null;
  tags?: string[];
};

export async function POST(request: Request) {
  const body = await parseJson<RetrospectiveBody>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (!body?.title?.trim() || !body.content?.trim()) return fail("title and content are required");

  try {
    const note = await writeRetrospectiveDraft({
      ownerId,
      title: body.title,
      content: body.content,
      projectId: body.project_id ?? body.projectId,
      taskId: body.task_id ?? body.taskId,
      agentId: body.agent_id ?? body.agentId,
      tags: body.tags
    });
    return ok(note, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Failed to write retrospective draft.",
      error instanceof ObsidianVaultConfigurationError ? 503 : 500
    );
  }
}
