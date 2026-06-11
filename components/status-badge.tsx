import type { AgentStatus, ApprovalStatus, RiskLevel, TaskStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

type BadgeTone = AgentStatus | ApprovalStatus | RiskLevel | TaskStatus | "default";

const toneClass: Record<BadgeTone, string> = {
  online: "bg-mint text-ink",
  busy: "bg-amber/20 text-[#7a4814]",
  idle: "bg-[#e8efe4] text-moss",
  offline: "bg-[#e2e6de] text-[#6e766d]",
  not_required: "bg-[#e8efe4] text-moss",
  pending: "bg-amber/20 text-[#7a4814]",
  approved: "bg-mint text-ink",
  rejected: "bg-clay/20 text-[#7a2f1f]",
  low: "bg-mint text-ink",
  medium: "bg-[#d8e7e1] text-moss",
  high: "bg-amber/20 text-[#7a4814]",
  critical: "bg-clay/20 text-[#7a2f1f]",
  backlog: "bg-[#e2e6de] text-[#6e766d]",
  todo: "bg-[#e8efe4] text-moss",
  in_progress: "bg-[#d8e7e1] text-moss",
  review: "bg-amber/20 text-[#7a4814]",
  blocked: "bg-clay/20 text-[#7a2f1f]",
  done: "bg-mint text-ink",
  cancelled: "bg-[#e2e6de] text-[#6e766d]",
  default: "bg-[#e8efe4] text-moss"
};

export function StatusBadge({ value, label }: { value: BadgeTone; label?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold", toneClass[value])}>
      {label ?? value}
    </span>
  );
}
