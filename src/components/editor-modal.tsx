import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/s3-api";
import { useToast } from "./toast";
import { Button, Modal, Spinner } from "./ui";

export type EditorTarget =
  | { mode: "edit"; bucket: string; key: string }
  | { mode: "create"; bucket: string; prefix: string };

export function EditorModal({
  target,
  onClose,
}: {
  target: EditorTarget | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [content, setContent] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const open = target !== null;

  // biome-ignore lint/correctness/useExhaustiveDependencies: re-init only when target changes
  useEffect(() => {
    if (!target) return;
    setContent("");
    setName("");
    if (target.mode === "edit") {
      setLoading(true);
      api
        .fetchText(target.bucket, target.key)
        .then(setContent)
        .catch((e) => toast.error((e as Error).message || t("error.loadContent")))
        .finally(() => setLoading(false));
    }
  }, [target]);

  if (!open || !target) return null;

  const title =
    target.mode === "edit"
      ? t("editor.editTitle", { key: target.key })
      : t("editor.createTitle", { prefix: target.prefix || t("editor.rootPrefix") });

  const handleSave = async () => {
    try {
      setSaving(true);
      if (target.mode === "create" && !name.trim()) {
        toast.error(t("editor.needName"));
        return;
      }
      const key = target.mode === "edit" ? target.key : `${target.prefix}${name}`;
      await api.saveObject(target.bucket, key, content);
      toast.success(t("editor.saved"));
      await qc.invalidateQueries({ queryKey: ["objects", target.bucket] });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title} className="max-w-3xl">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {target.mode === "create" && (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("editor.fileNamePlaceholder")}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          )}
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            spellCheck={false}
            className="h-80 w-full resize-none rounded-md border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand"
            placeholder={t("editor.contentPlaceholder")}
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {t("common.save")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
