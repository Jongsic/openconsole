import { RefreshCw, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Header bar for the resizable bottom detail panels: a free-form content slot
 * (title/badges/meta), an optional refresh button, and a close button.
 */
export function PanelHeader({
  children,
  onRefresh,
  refreshing,
  refreshTitle,
  onClose,
  closeTitle,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshTitle?: string;
  onClose: () => void;
  closeTitle?: string;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-2">
      {children}
      <div className="ml-auto flex items-center gap-1">
        {onRefresh && (
          <button
            type="button"
            title={refreshTitle}
            onClick={onRefresh}
            className="rounded-md p-1 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        )}
        <button
          type="button"
          title={closeTitle}
          onClick={onClose}
          className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
