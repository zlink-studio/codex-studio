import type { AgentStatus, ApprovalStatus, RiskLevel, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type BadgeTone = AgentStatus | ApprovalStatus | RiskLevel | TaskStatus | "default";

const toneClass: Record<BadgeTone, string> = {
  online: "bg-[#dff7ea] text-[#0f6b46] dark:bg-[#123828] dark:text-[#8de6bf]",
  busy: "bg-[#fff0d5] text-[#a45b00] dark:bg-[#36260e] dark:text-[#f6c26b]",
  idle: "bg-white/65 text-moss dark:bg-white/8 dark:text-[#c9d6ea]",
  offline: "bg-[#eef1f6] text-[#667085] dark:bg-[#1a2434] dark:text-[#95a3b8]",
  not_required: "bg-white/65 text-moss dark:bg-white/8 dark:text-[#c9d6ea]",
  pending: "bg-[#fff0d5] text-[#a45b00] dark:bg-[#36260e] dark:text-[#f6c26b]",
  approved: "bg-[#dff7ea] text-[#0f6b46] dark:bg-[#123828] dark:text-[#8de6bf]",
  rejected: "bg-[#ffe2e2] text-[#b42318] dark:bg-[#38171c] dark:text-[#ff9d9d]",
  manual_only: "bg-[#ffe2e2] text-[#b42318] dark:bg-[#38171c] dark:text-[#ff9d9d]",
  low: "bg-[#edf8f3] text-[#18634b] dark:bg-[#0f2e24] dark:text-[#7fdab4]",
  medium: "bg-[#edf2ff] text-[#4051b5] dark:bg-[#162246] dark:text-[#aab8ff]",
  high: "bg-[#fff0d5] text-[#a45b00] dark:bg-[#36260e] dark:text-[#f6c26b]",
  critical: "bg-[#ffe2e2] text-[#b42318] dark:bg-[#38171c] dark:text-[#ff9d9d]",
  backlog: "bg-[#eef1f6] text-[#667085] dark:bg-[#1a2434] dark:text-[#95a3b8]",
  todo: "bg-white/65 text-moss dark:bg-white/8 dark:text-[#c9d6ea]",
  in_progress: "bg-[#edf2ff] text-[#4051b5] dark:bg-[#162246] dark:text-[#aab8ff]",
  review: "bg-[#fff0d5] text-[#a45b00] dark:bg-[#36260e] dark:text-[#f6c26b]",
  blocked: "bg-[#ffe2e2] text-[#b42318] dark:bg-[#38171c] dark:text-[#ff9d9d]",
  waiting_boss_approval: "bg-[#fff0d5] text-[#a45b00] dark:bg-[#36260e] dark:text-[#f6c26b]",
  done: "bg-[#dff7ea] text-[#0f6b46] dark:bg-[#123828] dark:text-[#8de6bf]",
  cancelled: "bg-[#eef1f6] text-[#667085] dark:bg-[#1a2434] dark:text-[#95a3b8]",
  default: "bg-white/65 text-moss dark:bg-white/8 dark:text-[#c9d6ea]"
};

const labelMap: Record<string, string> = {
  online: "在线",
  busy: "忙碌",
  idle: "空闲",
  offline: "离线",
  not_required: "无需审批",
  pending: "待处理",
  approved: "已通过",
  rejected: "已拒绝",
  manual_only: "仅限人工",
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "关键风险",
  backlog: "待整理",
  todo: "待执行",
  in_progress: "执行中",
  review: "待复核",
  blocked: "已阻塞",
  waiting_boss_approval: "待确认",
  done: "已完成",
  cancelled: "已取消",
  default: "状态"
};

export function StatusBadge({ value, label }: { value: BadgeTone; label?: string }) {
  const tone = toneClass[value] ? value : "default";
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold", toneClass[tone])}>
      {label ?? labelMap[value] ?? value}
    </span>
  );
}
