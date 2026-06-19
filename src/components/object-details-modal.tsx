import { useQuery } from "@tanstack/react-query";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/s3-api";
import { formatBytes, formatDate, isImage } from "@/lib/utils";
import { Modal, Spinner } from "./ui";

export function ObjectDetailsModal({
  bucket,
  objectKey,
  onClose,
}: {
  bucket: string;
  objectKey: string | null;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  const open = objectKey !== null;
  const showImage = objectKey ? isImage(objectKey) : false;

  const details = useQuery({
    queryKey: ["object-details", bucket, objectKey],
    queryFn: () => api.getObjectDetails(bucket, objectKey as string),
    enabled: open,
  });

  // Image preview blob URL
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!open || !objectKey || !showImage) return;
    let revoked: string | null = null;
    let cancelled = false;
    api
      .objectBlobUrl(bucket, objectKey)
      .then((url) => {
        if (cancelled) {
          URL.revokeObjectURL(url);
          return;
        }
        revoked = url;
        setImgUrl(url);
      })
      .catch(() => setImgUrl(null));
    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
      setImgUrl(null);
    };
  }, [open, bucket, objectKey, showImage]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("details.title", { key: objectKey ?? "" })}
      className="max-w-2xl"
    >
      {details.isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <Spinner />
        </div>
      ) : details.isError ? (
        <p className="text-sm text-red-600">{(details.error as Error).message}</p>
      ) : details.data ? (
        <div className="flex flex-col gap-4 text-sm">
          {showImage && (
            <div className="flex justify-center rounded-lg border bg-slate-50 p-3">
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt={objectKey ?? ""}
                  className="max-h-80 max-w-full rounded object-contain"
                />
              ) : (
                <Spinner />
              )}
            </div>
          )}

          <Row label={t("details.contentType")}>
            <code className="text-slate-700">{details.data.contentType ?? "-"}</code>
          </Row>
          <Row label={t("common.size")}>{formatBytes(details.data.contentLength)}</Row>
          <Row label={t("common.modified")}>
            {formatDate(details.data.lastModified, i18n.language)}
          </Row>
          <Row label={t("details.etag")}>
            <code className="break-all text-xs text-slate-500">{details.data.etag ?? "-"}</code>
          </Row>

          <Row label={t("details.url")}>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <a
                  href={details.data.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 break-all font-mono text-xs text-brand hover:underline"
                >
                  {details.data.url}
                  <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                </a>
                <CopyButton text={details.data.url} />
              </div>
              <span className="text-xs text-slate-400">{t("details.urlNote")}</span>
            </div>
          </Row>

          {/* User metadata */}
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase text-slate-400">
              {t("details.metadata")}
            </div>
            {Object.keys(details.data.metadata).length === 0 ? (
              <p className="text-xs text-slate-400">{t("details.noMetadata")}</p>
            ) : (
              <KeyValueTable rows={Object.entries(details.data.metadata)} />
            )}
          </div>

          {/* Tags */}
          <div>
            <div className="mb-1.5 text-xs font-medium uppercase text-slate-400">
              {t("details.tags")}
            </div>
            {details.data.tags.length === 0 ? (
              <p className="text-xs text-slate-400">{t("details.noTags")}</p>
            ) : (
              <KeyValueTable rows={details.data.tags.map((tg) => [tg.key, tg.value])} />
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] items-start gap-2">
      <span className="text-xs font-medium uppercase text-slate-400">{label}</span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function KeyValueTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="w-full text-xs">
      <tbody className="divide-y divide-slate-100">
        {rows.map(([k, v]) => (
          <tr key={k}>
            <td className="w-1/3 py-1 pr-2 align-top font-medium text-slate-600">{k}</td>
            <td className="break-all py-1 text-slate-700">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
