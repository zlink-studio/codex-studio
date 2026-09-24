import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <section className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="max-w-3xl">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7774ff]">{eyebrow}</p>
        <h2 className="mt-2.5 text-[30px] font-medium tracking-[-0.035em] text-ink sm:text-[32px]">{title}</h2>
        {description ? <p className="mt-2 max-w-3xl text-[12px] leading-5 text-moss">{description}</p> : null}
      </div>
      {action}
    </section>
  );
}
