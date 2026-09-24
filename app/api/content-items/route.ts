import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { createContentItem, listContentItems, updateContentDraft } from "@/lib/content-operations";
import type { ContentAccountScope, ContentFormat, ContentPlatform } from "@/lib/types";
import { authorizeContentAdmin, ContentAuthenticationError } from "@/lib/content-auth";

export const dynamic = "force-dynamic";

type ContentBody = {
  id?: string;
  owner_id?: string;
  ownerId?: string;
  project_id?: string | null;
  projectId?: string | null;
  platform?: ContentPlatform;
  account_scope?: ContentAccountScope;
  accountScope?: ContentAccountScope;
  account_ref?: string | null;
  accountRef?: string | null;
  format?: ContentFormat;
  title?: string;
  caption?: string;
  script?: string | null;
  hashtags?: string[];
  asset_prompt?: string | null;
  assetPrompt?: string | null;
  scheduled_at?: string | null;
  scheduledAt?: string | null;
  created_by_agent_id?: string | null;
  createdByAgentId?: string | null;
  manual_minutes?: number;
  manualMinutes?: number;
};

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const ownerId = resolveOwnerId(Object.fromEntries(searchParams.entries()));
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  try {
    return ok(
      await listContentItems({
        ownerId,
        status: searchParams.get("status"),
        projectId: searchParams.get("project_id"),
        platform: searchParams.get("platform"),
        limit: Number(searchParams.get("limit") ?? 100)
      }),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return contentFailure(error);
  }
}

export async function POST(request: Request) {
  try {
    authorizeContentAdmin(request);
  } catch (error) {
    return authFailure(error);
  }
  const body = await parseJson<ContentBody>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (!body?.title?.trim() || !body.caption?.trim()) return fail("title and caption are required");
  try {
    const data = await createContentItem({
      ownerId,
      projectId: body.project_id ?? body.projectId,
      platform: body.platform,
      accountScope: body.account_scope ?? body.accountScope,
      accountRef: body.account_ref ?? body.accountRef,
      format: body.format,
      title: body.title,
      caption: body.caption,
      script: body.script,
      hashtags: body.hashtags,
      assetPrompt: body.asset_prompt ?? body.assetPrompt,
      scheduledAt: body.scheduled_at ?? body.scheduledAt,
      createdByAgentId: body.created_by_agent_id ?? body.createdByAgentId,
      manualMinutes: body.manual_minutes ?? body.manualMinutes
    });
    return ok(data, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return contentFailure(error);
  }
}

export async function PATCH(request: Request) {
  try {
    authorizeContentAdmin(request);
  } catch (error) {
    return authFailure(error);
  }
  const body = await parseJson<ContentBody>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (!body?.id) return fail("id is required");
  try {
    return ok(
      await updateContentDraft(ownerId, body.id, {
        title: body.title,
        caption: body.caption,
        script: body.script,
        hashtags: body.hashtags,
        assetPrompt: body.asset_prompt ?? body.assetPrompt,
        scheduledAt: body.scheduled_at ?? body.scheduledAt,
        accountRef: body.account_ref ?? body.accountRef,
        manualMinutes: body.manual_minutes ?? body.manualMinutes
      }),
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    return contentFailure(error);
  }
}

function contentFailure(error: unknown) {
  const message = error instanceof Error ? error.message : "Content operation failed.";
  return fail(message, message.includes("Supabase is required") || message.includes("disabled while USE_LOCAL_STORE") ? 503 : 409);
}

function authFailure(error: unknown) {
  return error instanceof ContentAuthenticationError
    ? fail(error.message, error.status)
    : fail("Content authentication failed.", 500);
}
