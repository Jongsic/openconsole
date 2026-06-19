import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { create } from "zustand";
import { cn } from "@/lib/utils";

type ToastKind = "success" | "error";
type Toast = { id: number; kind: ToastKind; message: string };

type ToastStore = {
  toasts: Toast[];
  push: (kind: ToastKind, message: string) => void;
  remove: (id: number) => void;
};

let seq = 1;

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  push: (kind, message) => {
    const id = seq++;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export function useToast() {
  const push = useToastStore((s) => s.push);
  return {
    success: (m: string) => push("success", m),
    error: (m: string) => push("error", m),
  };
}

export function ToastViewport() {
  const toasts = useToastStore((s) => s.toasts);
  const remove = useToastStore((s) => s.remove);

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      {toasts.map((t) => {
        const isError = t.kind === "error";
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-2 rounded-lg border p-3 text-sm shadow-lg",
              isError
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-green-200 bg-green-50 text-green-800",
            )}
          >
            {isError ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="flex-1 break-words">{t.message}</span>
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="shrink-0 opacity-60 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
