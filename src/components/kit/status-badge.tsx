import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type StatusTone = "green" | "amber" | "red" | "neutral" | "blue";

const TONE_STYLES: Record<StatusTone, string> = {
  green: "bg-green-100 text-green-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
  neutral: "bg-slate-100 text-slate-600",
  blue: "bg-brand-fg text-brand",
};

/**
 * A small colored status pill. Callers pass the already-resolved `tone`; the
 * label can be any node (typically the raw status string). Used to unify the
 * visual language of every status indicator (EC2 state, target health, …).
 */
export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
        TONE_STYLES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
