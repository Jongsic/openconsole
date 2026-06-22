import { Loader2, X } from "lucide-react";
import { type ButtonHTMLAttributes, type ReactNode, useEffect } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-brand text-white shadow-sm hover:bg-violet-700 disabled:bg-violet-300",
  secondary: "border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50",
  danger: "bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300",
  ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
};

export function Button({
  variant = "primary",
  className,
  loading,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; loading?: boolean }) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 disabled:cursor-not-allowed disabled:opacity-70",
        VARIANTS[variant],
        className,
      )}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("h-5 w-5 animate-spin text-slate-400", className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-xl bg-white shadow-xl",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h2 className="text-base font-semibold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: the control (children) is nested inside the label
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

/**
 * Standalone field label for inline edit forms where the control can't be
 * nested directly inside the <label> (e.g. multiple sibling inputs). Matches the
 * weight/color of <Field>'s label so all forms read consistently.
 */
export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn("text-xs font-medium text-slate-700", className)}>{children}</span>;
}

/**
 * A white, bordered form group with a short heading — the standard container for
 * inline edit forms (rule editors, attribute editors, capacity, etc). Replaces
 * the old flat gray fills so grouped editors read "intentional", not "disabled".
 */
export function FormCard({
  title,
  description,
  children,
  className,
}: {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-slate-200 bg-white p-4 shadow-sm", className)}>
      {title != null && (
        <div className="mb-3">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {description != null && <p className="mt-0.5 text-xs text-slate-500">{description}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

/** Shared control styling for inputs / selects / textareas. */
export const CONTROL_CLASS =
  "rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:bg-slate-100 disabled:text-slate-400";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(CONTROL_CLASS, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(CONTROL_CLASS, props.className)} />;
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cn(CONTROL_CLASS, "resize-none", props.className)} />;
}
