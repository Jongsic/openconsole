import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Section heading used above tables/editors inside detail panels. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
      {children}
    </div>
  );
}

/**
 * A bordered, subtly-filled container for grouping related editors/tables in a
 * detail panel (e.g. health-check + tags, ALB attributes). Optional `title`
 * renders a <SectionTitle> header.
 */
export function Card({
  title,
  children,
  className,
}: {
  title?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {title != null && <SectionTitle>{title}</SectionTitle>}
      {children}
    </div>
  );
}
