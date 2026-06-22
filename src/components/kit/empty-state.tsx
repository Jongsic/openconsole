import type { ComponentType, ReactNode } from "react";

/**
 * Centered "no resources" placeholder: a muted icon, a message, and an optional
 * action slot (e.g. a create button). Message is passed in already-translated.
 */
export function EmptyState({
  icon: Icon,
  message,
  action,
}: {
  icon: ComponentType<{ className?: string }>;
  message: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <Icon className="h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">{message}</p>
      {action != null && <div className="mt-1">{action}</div>}
    </div>
  );
}
