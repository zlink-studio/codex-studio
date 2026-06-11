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
    <section className={cn("rounded-lg border border-line bg-[#fbfcf8] p-5 shadow-soft", className)}>
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="text-base font-semibold text-ink">{title}</h3>}
          {description && <p className="mt-1 text-sm leading-6 text-moss">{description}</p>}
        </div>
      )}
      {children}
    </section>
  );
}
