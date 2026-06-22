import { RefreshCw } from "lucide-react";
import type { ComponentType, ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The standard list/detail page top bar: leading icon + title + subtitle, a
 * right-aligned `actions` slot, and a built-in refresh button.
 *
 * All text is passed in already-translated (callers own i18n). `onRefresh` and
 * `refreshing` wire up the spinning refresh affordance; omit `onRefresh` to hide it.
 */
export function PageHeader({
  icon: Icon,
  title,
  subtitle,
  actions,
  onRefresh,
  refreshing,
  refreshTitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  refreshTitle?: string;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
      <Icon className="h-5 w-5 shrink-0 text-brand" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-slate-900">{title}</div>
        {subtitle != null && <div className="truncate text-xs text-slate-500">{subtitle}</div>}
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
