import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Tag } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, CONTROL_CLASS } from "./ui";

/**
 * Reusable tag list editor. `current` seeds the rows; `onSave` receives the desired tags plus the
 * keys that were removed (so callers can diff against whatever tagging API they use).
 */
export function TagsEditor({
  current,
  onSave,
  saving,
}: {
  current: Tag[];
  onSave: (tags: Tag[], removedKeys: string[]) => void;
  saving?: boolean;
}) {
  const { t } = useTranslation();
  const [tags, setTags] = useState<Tag[]>(current);
  useEffect(() => setTags(current), [current]);

  const update = (i: number, patch: Partial<Tag>) =>
    setTags((prev) => prev.map((tg, idx) => (idx === i ? { ...tg, ...patch } : tg)));

  const save = () => {
    const originalKeys = new Set(current.map((tg) => tg.key));
    const keptKeys = new Set(tags.map((tg) => tg.key).filter(Boolean));
    const removedKeys = [...originalKeys].filter((k) => !keptKeys.has(k));
    onSave(tags, removedKeys);
  };

  return (
    <div className="flex max-w-2xl flex-col gap-3">
      {tags.length > 0 && (
        <div className="flex flex-col gap-2">
          {tags.map((tg, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: order-based editable rows
            <div key={i} className="flex items-center gap-2">
              <input
                value={tg.key}
                onChange={(e) => update(i, { key: e.target.value })}
                placeholder="Key"
                className={cn(CONTROL_CLASS, "w-48 py-1.5")}
              />
              <input
                value={tg.value}
                onChange={(e) => update(i, { value: e.target.value })}
                placeholder="Value"
                className={cn(CONTROL_CLASS, "flex-1 py-1.5")}
              />
              <button
                type="button"
                title={t("common.delete")}
                onClick={() => setTags((prev) => prev.filter((_, idx) => idx !== i))}
                className="rounded-md p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
      {tags.length === 0 && <p className="text-sm text-slate-500">{t("tags.none")}</p>}
      <div className="flex items-center justify-between gap-2">
        <Button variant="secondary" onClick={() => setTags((p) => [...p, { key: "", value: "" }])}>
          <Plus className="h-4 w-4" /> {t("tags.add")}
        </Button>
        <Button loading={saving} onClick={save}>
          {t("common.apply")}
        </Button>
      </div>
    </div>
  );
}
