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
    <section className={cn("glass-panel rounded-[28px] p-5 shadow-soft sm:p-6", className)}>
      {(title || description) && (
        <div className="mb-5">
          {title && <h3 className="text-lg font-semibold tracking-tight text-ink">{title}</h3>}
          {description && <p className="mt-1 text-sm leading-6 text-moss">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
