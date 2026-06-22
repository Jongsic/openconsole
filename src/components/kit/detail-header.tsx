import { ArrowLeft, RefreshCw } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Top bar for routed detail pages: a back button, title + meta line, an
 * optional right-aligned `actions` slot, and a built-in refresh button.
 *
 * Text is passed in already-translated. `meta` is rendered in a muted mono-ish
 * line (use it for ids/ARNs and dotted breadcrumb-style summaries).
 */
export function DetailHeader({
  title,
  meta,
  onBack,
  backTitle,
  actions,
  onRefresh,
  refreshing,
  refreshTitle,
}: {
  title: ReactNode;
  meta?: ReactNode;
  onBack: () => void;
  backTitle?: string;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshTitle?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <button
        type="button"
        title={backTitle}
        onClick={onBack}
        className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        {meta != null && (
          <div className="truncate font-mono text-[11px] text-slate-500">{meta}</div>
        )}
      </div>
      {actions != null && <div className="flex items-center gap-1.5">{actions}</div>}
      {onRefresh && (
        <button
          type="button"
          title={refreshTitle}
          onClick={onRefresh}
          className="ml-1 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      )}
    </header>
  );
}
