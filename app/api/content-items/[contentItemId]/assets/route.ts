import { fail, ok, parseJson, resolveOwnerId } from "@/lib/api";
import { requestContentAssetGeneration } from "@/lib/content-operations";
import { authorizeContentAdmin, ContentAuthenticationError } from "@/lib/content-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request, { params }: { params: { contentItemId: string } }) {
  try {
    authorizeContentAdmin(request);
  } catch (error) {
    return error instanceof ContentAuthenticationError ? fail(error.message, error.status) : fail("Content authentication failed.", 500);
  }
  const body = await parseJson<{
    owner_id?: string;
    ownerId?: string;
    provider?: "jimeng" | "kling";
    prompt?: string;
    aspect_ratio?: string;
  }>(request);
  const ownerId = resolveOwnerId(body);
  if (!ownerId) return fail("owner_id or DEMO_OWNER_ID is required", 503);
  if (!body?.provider || !["jimeng", "kling"].includes(body.provider)) return fail("provider must be jimeng or kling");
  try {
    return ok(
      await requestContentAssetGeneration({
        ownerId,
        contentItemId: params.contentItemId,
        provider: body.provider,
        prompt: body.prompt,
        aspectRatio: body.aspect_ratio
      }),
      { status: 202 }
    );
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Asset generation dispatch failed.", 409);
  }
}
