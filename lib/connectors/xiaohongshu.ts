import { triggerN8nWorkflow } from "@/lib/connectors/n8n";

export type XiaohongshuPublishInput = {
  ownerId: string;
  contentItemId: string;
  title: string;
  caption: string;
  hashtags: string[];
  format: "image_text" | "video";
  assetUrls: string[];
  coverUrl?: string | null;
  accountRef?: string | null;
  idempotencyKey: string;
};

export async function publishToXiaohongshu(input: XiaohongshuPublishInput) {
  if (!input.title.trim() || !input.caption.trim()) throw new Error("Xiaohongshu title and caption are required.");
  if (!input.assetUrls.length) throw new Error("At least one generated asset is required before publishing.");
  for (const assetUrl of input.assetUrls) {
    const parsed = new URL(assetUrl);
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
      throw new Error("Published assets must use HTTPS in production.");
    }
  }

  return triggerN8nWorkflow({
    ownerId: input.ownerId,
    workflow: "social.publish",
    actorId: "social-publisher",
    idempotencyKey: input.idempotencyKey,
    payload: {
      platform: "xiaohongshu",
      content_item_id: input.contentItemId,
      account_ref: input.accountRef,
      content: {
        title: input.title,
        caption: input.caption,
        hashtags: input.hashtags,
        format: input.format
      },
      assets: input.assetUrls.map((url) => ({ url })),
      cover_url: input.coverUrl,
      callback_path: "/api/content-items/callback"
    }
  });
}
