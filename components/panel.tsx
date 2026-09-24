import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Panel({
  children,
  className,
  title,
  description
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
}) {
  return (
    <section className={cn("glass-panel rounded-2xl p-5 sm:p-6", className)}>
      {(title || description) && (
        <div className="mb-5">
          {title && <h3 className="text-[13px] font-semibold tracking-tight text-ink">{title}</h3>}
          {description && <p className="mt-1 text-[11px] leading-5 text-moss">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
