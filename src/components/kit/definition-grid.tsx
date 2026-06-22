import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Responsive 2/3-column grid of <KV> property pairs. */
export function DefinitionGrid({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-x-8 gap-y-4 md:grid-cols-3", className)}>
      {children}
    </div>
  );
}

/**
 * One labeled property. `value` may be a string (with `—` fallback when empty)
 * or any node via `children`. `mono` renders the value as monospace — use it for
 * IDs, ARNs, IPs, and device names.
 */
export function KV({
  label,
  value,
  mono,
  children,
}: {
  label: ReactNode;
  value?: string | null;
  mono?: boolean;
  children?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-xs font-medium text-slate-500">{label}</div>
      {children != null ? (
        children
      ) : (
        <div className={cn("text-sm text-slate-800", mono && "break-all font-mono text-xs")}>
          {value || "—"}
        </div>
      )}
    </div>
  );
}
