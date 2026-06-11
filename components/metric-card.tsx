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
    <div className="rounded-lg border border-line bg-[#fbfcf8] p-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-moss">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-md bg-mint text-ink">
          <Icon size={20} />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-moss">{detail}</p>
    </div>
  );
}
