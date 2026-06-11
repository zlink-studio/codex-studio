import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-clay">{eyebrow}</p>
        <h2 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-moss">{description}</p>
      </div>
      {action}
    </section>
  );
}
