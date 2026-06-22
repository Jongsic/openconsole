import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronRight,
  CornerLeftUp,
  Download,
  File as FileIcon,
  FilePlus2,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Info,
  Pencil,
  RefreshCw,
  Settings2,
  Trash2,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/s3-api";
import { cn, formatBytes, formatDate, isImage, isTextLike, parentPrefix } from "@/lib/utils";
import { BucketPropertiesModal } from "./bucket-properties-modal";
import { EditorModal, type EditorTarget } from "./editor-modal";
import { ObjectDetailsModal } from "./object-details-modal";
import { useToast } from "./toast";
import { Button, Modal, Spinner } from "./ui";

export function ObjectBrowser({ bucket }: { bucket: string }) {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [prefix, setPrefix] = useState("");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [detailsKey, setDetailsKey] = useState<string | null>(null);
  const [deleteKey, setDeleteKey] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [propertiesOpen, setPropertiesOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const query = useQuery({
    queryKey: ["objects", bucket, prefix],
    queryFn: () => api.listObjects(bucket, prefix),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["objects", bucket] });

  const uploadMutation = useMutation({
    mutationFn: (files: FileList | File[]) => api.uploadFiles(bucket, prefix, files),
    onSuccess: () => {
      toast.success(t("object.uploaded"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deleteMutation = useMutation({
    mutationFn: (key: string) => api.deleteObject(bucket, key),
    onSuccess: () => {
      toast.success(t("object.deleted"));
      setDeleteKey(null);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const downloadMutation = useMutation({
    mutationFn: (key: string) => api.downloadObject(bucket, key),
    onError: (e) => toast.error((e as Error).message),
  });

  const segments = prefix ? prefix.replace(/\/$/, "").split("/") : [];
  const parent = parentPrefix(prefix);
  const goToSegment = (idx: number) => {
    if (idx < 0) return setPrefix("");
    setPrefix(`${segments.slice(0, idx + 1).join("/")}/`);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files.length > 0) uploadMutation.mutate(e.dataTransfer.files);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: file drag-and-drop upload area
    <section
      className="flex h-full flex-1 flex-col"
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex items-center gap-2 border-b bg-white px-4 py-3">
        <nav className="flex flex-1 flex-wrap items-center text-sm text-slate-500">
          <button
            type="button"
            onClick={() => goToSegment(-1)}
            className="font-semibold text-slate-700 hover:text-brand"
          >
            {bucket}
          </button>
          {segments.map((seg, i) => (
            <span key={segments.slice(0, i + 1).join("/")} className="flex items-center">
              <ChevronRight className="mx-0.5 h-4 w-4 text-slate-300" />
              <button type="button" onClick={() => goToSegment(i)} className="hover:text-brand">
                {seg}
              </button>
            </span>
          ))}
        </nav>

        <button
          type="button"
          title={t("common.refresh")}
          onClick={refresh}
          className="text-slate-400 hover:text-slate-600"
        >
          <RefreshCw className={cn("h-4 w-4", query.isFetching && "animate-spin")} />
        </button>
        <Button variant="secondary" onClick={() => setPropertiesOpen(true)}>
          <Settings2 className="h-4 w-4" /> {t("object.properties")}
        </Button>
        <Button variant="secondary" onClick={() => setNewFolderOpen(true)}>
          <FolderPlus className="h-4 w-4" /> {t("object.newFolder")}
        </Button>
        <Button variant="secondary" onClick={() => setEditor({ mode: "create", bucket, prefix })}>
          <FilePlus2 className="h-4 w-4" /> {t("object.newText")}
        </Button>
        <Button onClick={() => fileInput.current?.click()} loading={uploadMutation.isPending}>
          <Upload className="h-4 w-4" /> {t("object.upload")}
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) uploadMutation.mutate(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="relative flex-1 overflow-auto">
        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-10 m-3 flex items-center justify-center rounded-lg border-2 border-dashed border-brand bg-brand-fg/70 text-sm font-medium text-brand">
            {t("object.dropHere")}
          </div>
        )}

        {query.isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : query.isError ? (
          <div className="px-4 py-12 text-center text-sm text-red-600">
            {(query.error as Error).message}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">{t("common.name")}</th>
                <th className="w-28 px-4 py-2 font-medium">{t("common.size")}</th>
                <th className="w-48 px-4 py-2 font-medium">{t("common.modified")}</th>
                <th className="w-32 px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parent !== null && (
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setPrefix(parent)}
                      className="flex items-center gap-2 font-medium text-slate-500 hover:text-brand"
                      title={t("object.parent")}
                    >
                      <CornerLeftUp className="h-4 w-4" />
                      ..
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-300">-</td>
                  <td className="px-4 py-2 text-slate-300">-</td>
                  <td className="px-4 py-2" />
                </tr>
              )}
              {query.data?.folders.map((f) => (
                <tr key={f.prefix} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => setPrefix(f.prefix)}
                      className="flex items-center gap-2 font-medium text-slate-700 hover:text-brand"
                    >
                      <Folder className="h-4 w-4 text-amber-500" />
                      {f.name}/
                    </button>
                  </td>
                  <td className="px-4 py-2 text-slate-400">-</td>
                  <td className="px-4 py-2 text-slate-400">-</td>
                  <td className="px-4 py-2" />
                </tr>
              ))}

              {query.data?.objects.map((o) => (
                <tr key={o.key} className="group hover:bg-slate-50">
                  <td className="px-4 py-2">
                    {isImage(o.key) ? (
                      <button
                        type="button"
                        onClick={() => setDetailsKey(o.key)}
                        className="flex items-center gap-2 text-slate-700 hover:text-brand"
                        title={t("details.preview")}
                      >
                        <ImageIcon className="h-4 w-4 text-emerald-500" />
                        {o.name}
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-slate-700">
                        <FileIcon className="h-4 w-4 text-slate-400" />
                        {o.name}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-slate-500">{formatBytes(o.size)}</td>
                  <td className="px-4 py-2 text-slate-500">
                    {formatDate(o.lastModified, i18n.language)}
                  </td>
                  <td className="px-4 py-2">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100">
                      <IconBtn title={t("common.details")} onClick={() => setDetailsKey(o.key)}>
                        <Info className="h-4 w-4" />
                      </IconBtn>
                      {isTextLike(o.key) && (
                        <IconBtn
                          title={t("common.edit")}
                          onClick={() => setEditor({ mode: "edit", bucket, key: o.key })}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                      )}
                      <IconBtn
                        title={t("common.download")}
                        onClick={() => downloadMutation.mutate(o.key)}
                      >
                        <Download className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        title={t("common.delete")}
                        danger
                        onClick={() => setDeleteKey(o.key)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}

              {query.data && query.data.folders.length === 0 && query.data.objects.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-16 text-center text-sm text-slate-400">
                    {t("object.empty")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      <EditorModal target={editor} onClose={() => setEditor(null)} />
      <ObjectDetailsModal
        bucket={bucket}
        objectKey={detailsKey}
        onClose={() => setDetailsKey(null)}
      />
      <BucketPropertiesModal
        bucket={propertiesOpen ? bucket : null}
        onClose={() => setPropertiesOpen(false)}
      />

      <Modal
        open={deleteKey !== null}
        onClose={() => setDeleteKey(null)}
        title={t("object.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p className="break-all">{t("object.deleteConfirm", { key: deleteKey })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteKey(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={deleteMutation.isPending}
              onClick={() => deleteKey && deleteMutation.mutate(deleteKey)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>

      <NewFolderModal
        open={newFolderOpen}
        bucket={bucket}
        prefix={prefix}
        onClose={() => setNewFolderOpen(false)}
        onCreated={refresh}
      />
    </section>
  );
}

function IconBtn({
  children,
  title,
  danger,
  onClick,
}: {
  children: React.ReactNode;
  title: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "rounded p-1.5 text-slate-400 hover:bg-slate-200",
        danger ? "hover:text-red-600" : "hover:text-slate-700",
      )}
    >
      {children}
    </button>
  );
}

function NewFolderModal({
  open,
  bucket,
  prefix,
  onClose,
  onCreated,
}: {
  open: boolean;
  bucket: string;
  prefix: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const [name, setName] = useState("");

  const mutation = useMutation({
    mutationFn: () => api.saveObject(bucket, `${prefix}${name.replace(/\/$/, "")}/`, ""),
    onSuccess: () => {
      toast.success(t("object.folderCreated"));
      setName("");
      onCreated();
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("object.newFolderTitle")}>
      <div className="flex flex-col gap-3">
        <input
          // biome-ignore lint/a11y/noAutofocus: convenience focus when the modal opens
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && mutation.mutate()}
          placeholder={t("object.folderNamePlaceholder")}
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
