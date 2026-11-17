import type { ReactNode } from "react";

type SectionCardProps = {
  title: string;
  titleId: string;
  children: ReactNode;
};

export default function SectionCard({ title, titleId, children }: SectionCardProps) {
  return (
    <section
      aria-labelledby={titleId}
      className="rounded-xl border border-border bg-surface p-5 shadow-sm"
    >
      <h3 id={titleId} className="mb-4 text-base font-semibold text-heading">
        {title}
      </h3>
      {children}
    </section>
  );
}
