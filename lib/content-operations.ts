import { randomUUID } from "node:crypto";
import { triggerN8nWorkflow } from "@/lib/connectors/n8n";
import { publishToXiaohongshu } from "@/lib/connectors/xiaohongshu";
import { createSupabaseServerClient } from "@/lib/supabase";
import { isDemoDataEnabled } from "@/lib/runtime";
import type { ApprovalLevel, ContentAccountScope, ContentFormat, ContentPlatform } from "@/lib/types";

type JsonObject = Record<string, unknown>;
type ContentRow = Record<string, any>;

type CreateContentInput = {
  ownerId: string;
  projectId?: string | null;
  platform?: ContentPlatform;
  accountScope?: ContentAccountScope;
  accountRef?: string | null;
  format?: ContentFormat;
  title: string;
  caption: string;
  script?: string | null;
  hashtags?: string[];
  assetPrompt?: string | null;
  scheduledAt?: string | null;
  createdByAgentId?: string | null;
  manualMinutes?: number;
};

export type ContentCallback = {
  event_id: string;
  content_item_id: string;
  job_type: "asset_generation" | "publish";
  status: "succeeded" | "failed";
  execution_id?: string | null;
  assets?: Array<{ url?: string; type?: string }>;
  cover_url?: string | null;
  publication_id?: string | null;
  publication_url?: string | null;
  performance_metrics?: JsonObject;
  error?: string | null;
};

const FORBIDDEN_CLAIM_PATTERN = /(最低价|全网最低|保证效果|保证成交|百分百|100%|绝对有效|永久有效|零风险)/i;

export function contentApprovalLevel(accountScope: ContentAccountScope): ApprovalLevel {
  return accountScope === "client" ? "L2" : "L1";
}

export async function listContentItems(input: {
  ownerId: string;
  status?: string | null;
  projectId?: string | null;
  platform?: string | null;
  limit?: number;
}) {
  const db = requireDatabase();
  let query = db
    .from("content_items")
    .select("*")
    .eq("owner_id", input.ownerId)
    .order("created_at", { ascending: false })
    .limit(Math.max(1, Math.min(input.limit ?? 100, 300)));
  if (input.status) query = query.eq("status", input.status);
  if (input.projectId) query = query.eq("project_id", input.projectId);
  if (input.platform) query = query.eq("platform", input.platform);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getContentItem(ownerId: string, contentItemId: string) {
  const db = requireDatabase();
  const { data, error } = await db
    .from("content_items")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("id", contentItemId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Content item not found.");
  return data as ContentRow;
}

export async function createContentItem(input: CreateContentInput) {
  const db = requireDatabase();
  const accountScope = input.accountScope ?? "owned";
  const approvalLevel = contentApprovalLevel(accountScope);
  const scheduledAt = normalizeSchedule(input.scheduledAt);
  const record = {
    id: randomUUID(),
    owner_id: input.ownerId,
    project_id: input.projectId ?? null,
    platform: input.platform ?? "xiaohongshu",
    account_scope: accountScope,
    account_ref: input.accountRef ?? null,
    format: input.format ?? "image_text",
    title: input.title.trim(),
    caption: input.caption.trim(),
    script: input.script?.trim() || null,
    hashtags: sanitizeHashtags(input.hashtags ?? []),
    asset_prompt: input.assetPrompt?.trim() || null,
    scheduled_at: scheduledAt,
    approval_level: approvalLevel,
    approval_status: "not_required",
    status: "draft",
    idempotency_key: `content:${randomUUID()}`,
    manual_minutes: Math.max(0, Math.round(input.manualMinutes ?? 0)),
    created_by_agent_id: input.createdByAgentId ?? null
  };
  const { data, error } = await db.from("content_items").insert(record).select("*").single();
  if (error) throw new Error(error.message);
  await appendContentEvent(db, data, "content_created", "agent", input.createdByAgentId ?? "owner", {
    approvalLevel,
    accountScope
  });
  return data;
}

export async function updateContentDraft(
  ownerId: string,
  contentItemId: string,
  patch: Partial<{
    title: string;
    caption: string;
    script: string | null;
    hashtags: string[];
    assetPrompt: string | null;
    scheduledAt: string | null;
    accountRef: string | null;
    manualMinutes: number;
  }>
) {
  const db = requireDatabase();
  const current = await getContentItem(ownerId, contentItemId);
  if (["publishing", "published", "cancelled"].includes(current.status)) {
    throw new Error(`Content in ${current.status} cannot be edited.`);
  }
  const update: JsonObject = { updated_at: new Date().toISOString() };
  if (patch.title !== undefined) update.title = patch.title.trim();
  if (patch.caption !== undefined) update.caption = patch.caption.trim();
  if (patch.script !== undefined) update.script = patch.script?.trim() || null;
  if (patch.hashtags !== undefined) update.hashtags = sanitizeHashtags(patch.hashtags);
  if (patch.assetPrompt !== undefined) update.asset_prompt = patch.assetPrompt?.trim() || null;
  if (patch.scheduledAt !== undefined) update.scheduled_at = normalizeSchedule(patch.scheduledAt);
  if (patch.accountRef !== undefined) update.account_ref = patch.accountRef?.trim() || null;
  if (patch.manualMinutes !== undefined) update.manual_minutes = Math.max(0, Math.round(patch.manualMinutes));
  const { data, error } = await db
    .from("content_items")
    .update(update)
    .eq("owner_id", ownerId)
    .eq("id", contentItemId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  await appendContentEvent(db, data, "draft_updated", "owner", "owner", { fields: Object.keys(update) });
  return data;
}

export async function requestContentAssetGeneration(input: {
  ownerId: string;
  contentItemId: string;
  provider: "jimeng" | "kling";
  prompt?: string | null;
  aspectRatio?: string | null;
}) {
  const db = requireDatabase();
  const item = await getContentItem(input.ownerId, input.contentItemId);
  if (["publishing", "published", "cancelled"].includes(item.status)) {
    throw new Error(`Cannot generate assets for content in ${item.status}.`);
  }
  const prompt = input.prompt?.trim() || item.asset_prompt || item.script || item.caption;
  if (!prompt) throw new Error("An asset prompt, script or caption is required.");

  const { error: updateError } = await db
    .from("content_items")
    .update({
      asset_provider: input.provider,
      asset_prompt: prompt,
      asset_status: "generating",
      status: "asset_generating",
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", input.ownerId)
    .eq("id", input.contentItemId);
  if (updateError) throw new Error(updateError.message);

  try {
    const result = await triggerN8nWorkflow({
      ownerId: input.ownerId,
      workflow: "social.asset.generate",
      actorId: "social-visual-producer",
      idempotencyKey: `${item.idempotency_key}:asset:${input.provider}`,
      payload: {
        content_item_id: item.id,
        provider: input.provider,
        format: item.format,
        prompt,
        aspect_ratio: input.aspectRatio ?? "3:4",
        storage_bucket: "social-assets",
        callback_path: "/api/content-items/callback"
      }
    });
    await db
      .from("content_items")
      .update({ n8n_execution_id: result.executionId, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("owner_id", input.ownerId);
    await appendContentEvent(db, item, "asset_generation_dispatched", "agent", "social-visual-producer", {
      provider: input.provider,
      executionId: result.executionId
    });
    return { itemId: item.id, ...result };
  } catch (error) {
    await db
      .from("content_items")
      .update({ asset_status: "failed", status: "asset_failed", last_error: errorMessage(error), updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("owner_id", input.ownerId);
    await appendContentEvent(db, item, "asset_generation_failed", "system", "n8n", { error: errorMessage(error) });
    throw error;
  }
}

export async function reviewContentItem(input: {
  ownerId: string;
  contentItemId: string;
  reviewerAgentId?: string | null;
  score: number;
  notes?: string | null;
  checklist?: unknown[];
}) {
  const db = requireDatabase();
  const item = await getContentItem(input.ownerId, input.contentItemId);
  const checks = [
    { key: "title", passed: Boolean(item.title?.trim()), message: "标题不能为空" },
    { key: "caption", passed: Boolean(item.caption?.trim()), message: "正文不能为空" },
    { key: "assets", passed: Array.isArray(item.asset_urls) && item.asset_urls.length > 0, message: "至少需要一个已回写素材" },
    {
      key: "forbidden_claims",
      passed: !FORBIDDEN_CLAIM_PATTERN.test(`${item.title} ${item.caption}`),
      message: "命中最低价、保证效果或绝对化表述"
    }
  ];
  const approved = input.score >= 80 && checks.every((check) => check.passed);
  const approvalLevel = contentApprovalLevel(item.account_scope);
  const approvalStatus = approved ? (approvalLevel === "L2" ? "pending" : "approved") : "not_required";
  const nextStatus = approved ? (approvalLevel === "L2" ? "pending_approval" : item.scheduled_at ? "scheduled" : "approved") : "rejected";
  const checklist = [...checks, ...(input.checklist ?? [])];

  const { data, error } = await db
    .from("content_items")
    .update({
      quality_status: approved ? "approved" : "rejected",
      quality_score: Math.max(0, Math.min(100, Math.round(input.score))),
      quality_checklist: checklist,
      quality_notes: input.notes ?? null,
      approval_level: approvalLevel,
      approval_status: approvalStatus,
      status: nextStatus,
      reviewed_by_agent_id: input.reviewerAgentId ?? null,
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", input.ownerId)
    .eq("id", input.contentItemId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  if (approved && approvalLevel === "L2") {
    const { data: existing } = await db
      .from("approvals")
      .select("id")
      .eq("owner_id", input.ownerId)
      .eq("subject_type", "content_item")
      .eq("subject_id", input.contentItemId)
      .eq("status", "pending")
      .maybeSingle();
    if (!existing) {
      const { error: approvalError } = await db.from("approvals").insert({
        owner_id: input.ownerId,
        task_id: null,
        subject_type: "content_item",
        subject_id: input.contentItemId,
        requested_by_agent_id: input.reviewerAgentId ?? null,
        status: "pending",
        reason: "客户账号内容发布属于 L2，必须由主理人事前审批。"
      });
      if (approvalError) throw new Error(approvalError.message);
    }
  }

  await appendContentEvent(db, data, approved ? "quality_approved" : "quality_rejected", "agent", input.reviewerAgentId ?? "reviewer", {
    score: input.score,
    checks
  });
  return data;
}

export async function decideContentApproval(input: {
  ownerId: string;
  contentItemId: string;
  decision: "approved" | "rejected";
  decisionNote?: string | null;
}) {
  const db = requireDatabase();
  const item = await getContentItem(input.ownerId, input.contentItemId);
  if (item.approval_level !== "L2" || item.approval_status !== "pending") {
    throw new Error("Only pending L2 content can be decided through this approval gate.");
  }
  const status = input.decision === "approved" ? (item.scheduled_at ? "scheduled" : "approved") : "rejected";
  const decidedAt = new Date().toISOString();
  const { data, error } = await db
    .from("content_items")
    .update({ approval_status: input.decision, status, updated_at: decidedAt })
    .eq("owner_id", input.ownerId)
    .eq("id", input.contentItemId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  const { error: approvalError } = await db
    .from("approvals")
    .update({ status: input.decision, decision_note: input.decisionNote ?? null, decided_at: decidedAt })
    .eq("owner_id", input.ownerId)
    .eq("subject_type", "content_item")
    .eq("subject_id", input.contentItemId)
    .eq("status", "pending");
  if (approvalError) throw new Error(approvalError.message);
  await appendContentEvent(db, data, `approval_${input.decision}`, "owner", "owner", { decisionNote: input.decisionNote ?? null });
  return data;
}

export async function dispatchContentItem(ownerId: string, contentItemId: string) {
  const db = requireDatabase();
  const item = await getContentItem(ownerId, contentItemId);
  assertPublishAllowed(item);
  const attempt = Number(item.publish_attempts ?? 0) + 1;
  const { data: claimed, error: lockError } = await db
    .from("content_items")
    .update({
      status: "publishing",
      publish_attempts: attempt,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq("owner_id", ownerId)
    .eq("id", contentItemId)
    .eq("status", item.status)
    .select("id")
    .maybeSingle();
  if (lockError) throw new Error(lockError.message);
  if (!claimed) throw new Error("Content publish was already claimed by another worker.");

  try {
    if (item.platform !== "xiaohongshu") throw new Error(`Unsupported social platform: ${item.platform}`);
    const result = await publishToXiaohongshu({
      ownerId,
      contentItemId: item.id,
      title: item.title,
      caption: item.caption,
      hashtags: item.hashtags ?? [],
      format: item.format,
      assetUrls: item.asset_urls ?? [],
      coverUrl: item.cover_url,
      accountRef: item.account_ref,
      idempotencyKey: `${item.idempotency_key}:publish`
    });
    await db
      .from("content_items")
      .update({ n8n_execution_id: result.executionId, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("owner_id", ownerId);
    await appendContentEvent(db, item, "publish_dispatched", "agent", "social-publisher", {
      attempt,
      executionId: result.executionId
    });
    return { itemId: item.id, attempt, ...result };
  } catch (error) {
    const nextAttemptAt = new Date(Date.now() + retryDelayMs(attempt)).toISOString();
    await db
      .from("content_items")
      .update({ status: "publish_failed", last_error: errorMessage(error), next_attempt_at: nextAttemptAt, updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .eq("owner_id", ownerId);
    await appendContentEvent(db, item, "publish_dispatch_failed", "system", "n8n", {
      attempt,
      nextAttemptAt,
      error: errorMessage(error)
    });
    throw error;
  }
}

export async function dispatchQueuedContent(ownerId: string, limit = 20) {
  const db = requireDatabase();
  const { data, error } = await db
    .from("content_items")
    .select("id")
    .eq("owner_id", ownerId)
    .eq("status", "publish_queued")
    .order("scheduled_at", { ascending: true })
    .limit(Math.max(1, Math.min(limit, 100)));
  if (error) throw new Error(error.message);
  const result = { scanned: data?.length ?? 0, dispatched: 0, failed: 0, errors: [] as string[] };
  for (const item of data ?? []) {
    try {
      await dispatchContentItem(ownerId, item.id);
      result.dispatched += 1;
    } catch (dispatchError) {
      result.failed += 1;
      result.errors.push(`${item.id}: ${errorMessage(dispatchError)}`);
    }
  }
  return result;
}

export async function handleContentCallback(callback: ContentCallback) {
  const db = requireDatabase();
  const { data: item, error } = await db.from("content_items").select("*").eq("id", callback.content_item_id).maybeSingle();
  if (error) throw new Error(error.message);
  if (!item) throw new Error("Content item not found for callback.");

  const { data: duplicate, error: duplicateError } = await db
    .from("content_item_events")
    .select("id")
    .eq("external_event_id", callback.event_id)
    .maybeSingle();
  if (duplicateError) throw new Error(duplicateError.message);
  if (duplicate) return { duplicate: true, item };

  if (callback.job_type === "asset_generation") {
    if (callback.status === "succeeded") {
      const assetUrls = (callback.assets ?? []).map((asset) => asset.url).filter((url): url is string => Boolean(url));
      if (!assetUrls.length) throw new Error("Successful asset callback must include at least one asset URL.");
      assertAssetUrls(assetUrls);
      const { data, error: updateError } = await db
        .from("content_items")
        .update({
          asset_urls: assetUrls,
          cover_url: callback.cover_url ?? assetUrls[0],
          asset_status: "ready",
          status: "review",
          n8n_execution_id: callback.execution_id ?? item.n8n_execution_id,
          last_error: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", item.id)
        .select("*")
        .single();
      if (updateError) throw new Error(updateError.message);
      await appendContentEvent(db, item, "assets_ready", "n8n", callback.execution_id ?? "n8n", { assetUrls }, callback.event_id);
      return { duplicate: false, item: data };
    }
    const { data, error: updateError } = await db
      .from("content_items")
      .update({ asset_status: "failed", status: "asset_failed", last_error: callback.error ?? "Asset generation failed.", updated_at: new Date().toISOString() })
      .eq("id", item.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    await appendContentEvent(db, item, "asset_generation_failed", "n8n", callback.execution_id ?? "n8n", { error: callback.error }, callback.event_id);
    return { duplicate: false, item: data };
  }

  if (callback.status === "succeeded") {
    const { data, error: updateError } = await db
      .from("content_items")
      .update({
        status: "published",
        publication_id: callback.publication_id ?? null,
        publication_url: callback.publication_url ?? null,
        performance_metrics: callback.performance_metrics ?? item.performance_metrics ?? {},
        published_at: new Date().toISOString(),
        n8n_execution_id: callback.execution_id ?? item.n8n_execution_id,
        last_error: null,
        next_attempt_at: null,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .select("*")
      .single();
    if (updateError) throw new Error(updateError.message);
    await appendContentEvent(db, item, "published", "n8n", callback.execution_id ?? "n8n", {
      publicationId: callback.publication_id,
      publicationUrl: callback.publication_url,
      approvalLevel: item.approval_level
    }, callback.event_id);
    return { duplicate: false, item: data, ownerNotificationRequired: item.approval_level === "L1" };
  }

  const attempt = Number(item.publish_attempts ?? 1);
  const nextAttemptAt = attempt < 5 ? new Date(Date.now() + retryDelayMs(attempt)).toISOString() : null;
  const { data, error: updateError } = await db
    .from("content_items")
    .update({
      status: "publish_failed",
      last_error: callback.error ?? "Publishing failed.",
      next_attempt_at: nextAttemptAt,
      n8n_execution_id: callback.execution_id ?? item.n8n_execution_id,
      updated_at: new Date().toISOString()
    })
    .eq("id", item.id)
    .select("*")
    .single();
  if (updateError) throw new Error(updateError.message);
  await appendContentEvent(db, item, "publish_failed", "n8n", callback.execution_id ?? "n8n", {
    error: callback.error,
    nextAttemptAt
  }, callback.event_id);
  return { duplicate: false, item: data };
}

export async function listContentEvents(ownerId: string, contentItemId: string) {
  const db = requireDatabase();
  const { data, error } = await db
    .from("content_item_events")
    .select("*")
    .eq("owner_id", ownerId)
    .eq("content_item_id", contentItemId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function assertPublishAllowed(item: ContentRow) {
  if (item.quality_status !== "approved") throw new Error("Publishing is blocked until quality review is approved.");
  if (item.approval_status !== "approved") throw new Error(`${item.approval_level} publishing is blocked until its approval gate is satisfied.`);
  if (!["approved", "scheduled", "publish_queued", "publish_failed"].includes(item.status)) {
    throw new Error(`Content in ${item.status} cannot be published.`);
  }
  if (item.status !== "publish_queued" && item.scheduled_at && Date.parse(item.scheduled_at) > Date.now()) {
    throw new Error("Content cannot be published before its scheduled time.");
  }
  if (!Array.isArray(item.asset_urls) || item.asset_urls.length === 0) throw new Error("Publishing is blocked until assets are ready.");
  if (Number(item.publish_attempts ?? 0) >= 5) throw new Error("Publishing retry limit reached; owner intervention is required.");
}

function sanitizeHashtags(values: string[]) {
  return Array.from(new Set(values.map((value) => value.replace(/^#/, "").trim()).filter(Boolean))).slice(0, 20);
}

function normalizeSchedule(value?: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error("scheduledAt must be a valid ISO date-time.");
  return new Date(timestamp).toISOString();
}

function assertAssetUrls(urls: string[]) {
  for (const value of urls) {
    const parsed = new URL(value);
    if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Asset URLs must use HTTP or HTTPS.");
    if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") throw new Error("Asset URLs must use HTTPS in production.");
  }
}

function retryDelayMs(attempt: number) {
  return Math.min(6 * 60 * 60 * 1000, 15 * 60 * 1000 * 2 ** Math.max(0, attempt - 1));
}

async function appendContentEvent(
  db: NonNullable<ReturnType<typeof createSupabaseServerClient>>,
  item: ContentRow,
  eventType: string,
  actorType: string,
  actorId: string | null,
  details: JsonObject,
  externalEventId?: string
) {
  const { error } = await db.from("content_item_events").insert({
    owner_id: item.owner_id,
    content_item_id: item.id,
    event_type: eventType,
    actor_type: actorType,
    actor_id: actorId,
    external_event_id: externalEventId ?? null,
    details
  });
  if (error) throw new Error(`Content event logging failed: ${error.message}`);
}

function requireDatabase() {
  if (isDemoDataEnabled()) throw new Error("The social content pipeline is disabled while USE_LOCAL_STORE=true.");
  const db = createSupabaseServerClient();
  if (!db) throw new Error("Supabase is required for the social content pipeline.");
  return db;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown content workflow error.";
}
