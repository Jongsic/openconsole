import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/s3-api";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { Button, Modal, Spinner } from "./ui";

export function BucketSidebar({
  selected,
  onSelect,
}: {
  selected: string | null;
  onSelect: (bucket: string | null) => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const buckets = useQuery({ queryKey: ["buckets"], queryFn: api.listBuckets });

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r bg-white">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <Database className="h-5 w-5 text-brand" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-slate-800">{t("bucket.heading")}</div>
          <div className="text-[11px] text-slate-400">{t("bucket.subtitle")}</div>
        </div>
        <button
          type="button"
          title={t("common.refresh")}
          onClick={() => qc.invalidateQueries({ queryKey: ["buckets"] })}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", buckets.isFetching && "animate-spin")} />
        </button>
      </div>

      <div className="flex-1 overflow-auto p-2">
        {buckets.isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : buckets.isError ? (
          <div className="px-3 py-6 text-center text-xs text-red-600">
            {(buckets.error as Error).message}
          </div>
        ) : buckets.data && buckets.data.length > 0 ? (
          <ul className="flex flex-col gap-0.5">
            {buckets.data.map((b) => (
              <li key={b.name}>
                <button
                  type="button"
                  onClick={() => onSelect(b.name)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm",
                    selected === b.name
                      ? "bg-brand-fg font-medium text-brand"
                      : "text-slate-700 hover:bg-slate-100",
                  )}
                >
                  <Database className="h-4 w-4 shrink-0 opacity-60" />
                  <span className="flex-1 truncate">{b.name}</span>
                  <Trash2
                    className="h-4 w-4 shrink-0 text-slate-300 opacity-0 hover:text-red-500 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(b.name);
                    }}
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-3 py-8 text-center text-xs text-slate-400">{t("bucket.none")}</div>
        )}
      </div>

      <div className="border-t p-3">
        <Button className="w-full" onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4" /> {t("bucket.create")}
        </Button>
      </div>

      <CreateBucketModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <DeleteBucketModal
        bucket={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={(name) => {
          if (selected === name) onSelect(null);
        }}
      />
    </aside>
  );
}

function CreateBucketModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.createBucket(name.trim()),
    onSuccess: () => {
      toast.success(t("bucket.created", { name }));
      qc.invalidateQueries({ queryKey: ["buckets"] });
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("bucket.createTitle")}>
      <div className="flex flex-col gap-3">
        <input
          // biome-ignore lint/a11y/noAutofocus: convenience focus when the modal opens
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && mutation.mutate()}
          placeholder={t("bucket.namePlaceholder")}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            loading={mutation.isPending}
            disabled={!name.trim()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function DeleteBucketModal({
  bucket,
  onClose,
  onDeleted,
}: {
  bucket: string | null;
  onClose: () => void;
  onDeleted: (name: string) => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [force, setForce] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.deleteBucket(bucket as string, force),
    onSuccess: () => {
      toast.success(t("bucket.deleted", { name: bucket }));
      qc.invalidateQueries({ queryKey: ["buckets"] });
      if (bucket) onDeleted(bucket);
      setForce(false);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={bucket !== null} onClose={onClose} title={t("bucket.deleteTitle")}>
      <div className="flex flex-col gap-3 text-sm">
        <p>{t("bucket.deleteConfirm", { name: bucket })}</p>
        <label className="flex items-center gap-2 text-slate-600">
          <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
          {t("bucket.forceDelete")}
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            {t("common.delete")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
