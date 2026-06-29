"use client";

import type { ReactNode } from "react";
import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function CollapsiblePanel({
  title,
  description,
  children,
  className,
  defaultOpen = true,
  badge,
  icon
}: {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  badge?: ReactNode;
  icon?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const regionId = useId();

  return (
    <section className={cn("glass-panel overflow-hidden rounded-[28px] shadow-soft", className)}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={regionId}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/30 sm:px-6 dark:hover:bg-white/5"
      >
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-white/40 bg-white/45 text-moss dark:bg-white/5">
            {icon}
          </span>
        ) : null}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-lg font-semibold tracking-tight text-ink">{title}</span>
            {badge}
          </span>
          {description ? <span className="mt-0.5 block truncate text-sm text-moss">{description}</span> : null}
        </span>
        <ChevronDown
          size={20}
          className={cn("shrink-0 text-moss transition-transform duration-300", open ? "rotate-180" : "rotate-0")}
        />
      </button>
      <div
        id={regionId}
        className={cn(
          "grid transition-all duration-300 ease-out",
          open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="border-t border-line/60 px-5 py-5 sm:px-6">{children}</div>
        </div>
      </div>
    </section>
  );
}
