import { createSupabaseServerClient } from "@/lib/supabase";
import { isDemoDataEnabled } from "@/lib/runtime";

export type ContentOperationsMetrics = {
  windowDays: number;
  published: number;
  failed: number;
  pendingApproval: number;
  publicationDays: number;
  currentDailyStreak: number;
  manualMinutes: number;
  averageManualMinutesPerDay: number;
  fourWeekDailyTargetMet: boolean;
  interventionTargetMet: boolean;
};

export async function getContentOperationsMetrics(ownerId: string, windowDays = 28): Promise<ContentOperationsMetrics> {
  const db = createSupabaseServerClient();
  const days = Math.max(1, Math.min(Math.round(windowDays), 90));
  if (!db || isDemoDataEnabled()) return emptyMetrics(days);
  const timeZone = process.env.CONTENT_TIMEZONE?.trim() || "Asia/Shanghai";
  const since = new Date(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
  since.setUTCHours(0, 0, 0, 0);

  const [{ data: recent, error: recentError }, { count: pendingApproval, error: pendingError }] = await Promise.all([
    db
      .from("content_items")
      .select("status,published_at,manual_minutes")
      .eq("owner_id", ownerId)
      .gte("updated_at", since.toISOString()),
    db
      .from("content_items")
      .select("id", { count: "exact", head: true })
      .eq("owner_id", ownerId)
      .eq("approval_status", "pending")
  ]);
  if (recentError) throw new Error(recentError.message);
  if (pendingError) throw new Error(pendingError.message);

  const rows = recent ?? [];
  const publicationDaySet = new Set(
    rows
      .filter((item) => item.status === "published" && item.published_at)
      .map((item) => getDateKey(String(item.published_at), timeZone))
  );
  const currentDailyStreak = calculateStreak(publicationDaySet, timeZone);
  const manualMinutes = rows.reduce((total, item) => total + Number(item.manual_minutes ?? 0), 0);
  const averageManualMinutesPerDay = Number((manualMinutes / days).toFixed(1));

  return {
    windowDays: days,
    published: rows.filter((item) => item.status === "published").length,
    failed: rows.filter((item) => ["asset_failed", "publish_failed"].includes(item.status)).length,
    pendingApproval: pendingApproval ?? 0,
    publicationDays: publicationDaySet.size,
    currentDailyStreak,
    manualMinutes,
    averageManualMinutesPerDay,
    fourWeekDailyTargetMet: publicationDaySet.size >= 28 && currentDailyStreak >= 28,
    interventionTargetMet: averageManualMinutesPerDay < 30
  };
}

function calculateStreak(publicationDays: Set<string>, timeZone: string) {
  let cursor = new Date();
  const today = getDateKey(cursor.toISOString(), timeZone);
  if (!publicationDays.has(today)) cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  let streak = 0;
  while (publicationDays.has(getDateKey(cursor.toISOString(), timeZone))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000);
  }
  return streak;
}

function getDateKey(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

function emptyMetrics(windowDays: number): ContentOperationsMetrics {
  return {
    windowDays,
    published: 0,
    failed: 0,
    pendingApproval: 0,
    publicationDays: 0,
    currentDailyStreak: 0,
    manualMinutes: 0,
    averageManualMinutesPerDay: 0,
    fourWeekDailyTargetMet: false,
    interventionTargetMet: true
  };
}
