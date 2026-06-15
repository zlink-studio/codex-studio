import type { LucideIcon } from "lucide-react";

export function MetricCard({
  label,
  value,
  detail,
  icon: Icon
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <div className="glass-panel rounded-[26px] p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-moss/85">{label}</p>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-ink">{value}</p>
        </div>
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-white/55 text-ink dark:bg-white/10">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-4 text-sm leading-6 text-moss">{detail}</p>
    </div>
  );
}
