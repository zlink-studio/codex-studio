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
    <div className="glass-panel rounded-2xl p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium text-moss">{label}</p>
          <p className="mt-4 text-[27px] font-medium tracking-[-0.04em] text-ink">{value}</p>
        </div>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-line bg-white/[0.025] text-moss">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-2 text-[10px] leading-5 text-moss/55">{detail}</p>
    </div>
  );
}
