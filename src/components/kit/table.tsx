import type { ReactNode, ThHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { Spinner } from "../ui";

/* ── Low-level styled table primitives ──────────────────────────────────────
 * These render a polished, consistent table with sticky header, header bg, row
 * hover, selectable rows and consistent cell padding. Compose them directly for
 * detail-panel tables; for full list views prefer <ResourceTable> below.
 */

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return <table className={cn("w-full text-left text-sm", className)}>{children}</table>;
}

/** Sticky header band. `sticky` (default true) keeps it pinned while scrolling. */
export function Thead({
  children,
  sticky = true,
  className,
}: {
  children: ReactNode;
  sticky?: boolean;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500",
        sticky && "sticky top-0 z-10",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function Th({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("px-4 py-2.5 font-semibold", className)} {...props}>
      {children}
    </th>
  );
}

export function Td({
  children,
  mono,
  muted,
  className,
}: {
  children: ReactNode;
  /** Render as monospace + xs — use for IDs/ARNs/IPs. */
  mono?: boolean;
  /** Lighter text — use for secondary/metadata columns. */
  muted?: boolean;
  className?: string;
}) {
  return (
    <td
      className={cn(
        "px-4 py-2.5",
        mono
          ? "font-mono text-xs text-slate-600"
          : muted
            ? "text-xs text-slate-500"
            : "text-slate-700",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  onClick,
  selected,
  className,
}: {
  children: ReactNode;
  onClick?: () => void;
  selected?: boolean;
  className?: string;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b border-slate-100 transition-colors",
        onClick && "cursor-pointer hover:bg-slate-50",
        selected &&
          "bg-brand-fg shadow-[inset_3px_0_0_0_theme(colors.brand.DEFAULT)] hover:bg-brand-tint",
        className,
      )}
    >
      {children}
    </tr>
  );
}

/* ── State helpers ─────────────────────────────────────────────────────────── */

export function TableLoading() {
  return (
    <div className="flex justify-center py-16">
      <Spinner />
    </div>
  );
}
