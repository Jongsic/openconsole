import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/s3-api";
import type {
  BucketProperties,
  Tag,
  UpdatePropertyInput,
  VersioningStatus,
  WebsiteConfig,
} from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { Button, Modal, Spinner } from "./ui";

type Section = "versioning" | "tagging" | "encryption" | "website" | "cors" | "policy";
const SECTION_KEYS: Section[] = [
  "versioning",
  "tagging",
  "encryption",
  "website",
  "cors",
  "policy",
];

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
      className="rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function BucketPropertiesModal({
  bucket,
  onClose,
}: {
  bucket: string | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [section, setSection] = useState<Section>("versioning");
  const open = bucket !== null;

  const query = useQuery({
    queryKey: ["properties", bucket],
    queryFn: () => api.getProperties(bucket as string),
    enabled: open,
  });

  const arn = bucket ? `arn:aws:s3:::${bucket}` : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("props.title", { name: bucket ?? "" })}
      className="max-w-3xl"
    >
      {bucket && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-medium uppercase text-slate-500">{t("props.arn")}</span>
          <code className="flex-1 truncate font-mono text-xs text-slate-700">{arn}</code>
          <CopyButton text={arn} />
        </div>
      )}

      <div className="flex min-h-[26rem] gap-4">
        <ul className="w-36 shrink-0 space-y-0.5">
          {SECTION_KEYS.map((s) => (
            <li key={s}>
              <button
                type="button"
                onClick={() => setSection(s)}
                className={cn(
                  "w-full rounded-md px-3 py-2 text-left text-sm",
                  section === s
                    ? "bg-brand-fg font-medium text-brand"
                    : "text-slate-600 hover:bg-slate-100",
                )}
              >
                {t(`props.sections.${s}`)}
              </button>
            </li>
          ))}
        </ul>

        <div className="flex-1 border-l pl-4">
          {query.isLoading || !bucket ? (
            <div className="flex h-full items-center justify-center">
              <Spinner />
            </div>
          ) : query.isError ? (
            <p className="text-sm text-red-600">{(query.error as Error).message}</p>
          ) : query.data ? (
            <SectionEditor bucket={bucket} section={section} data={query.data} />
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

function SectionEditor({
  bucket,
  section,
  data,
}: {
  bucket: string;
  section: Section;
  data: BucketProperties;
}) {
  switch (section) {
    case "versioning":
      return <VersioningEditor bucket={bucket} current={data.versioning.status} />;
    case "tagging":
      return <TaggingEditor bucket={bucket} current={data.tagging.tags} />;
    case "encryption":
      return <EncryptionEditor bucket={bucket} current={data.encryption} />;
    case "website":
      return <WebsiteEditor bucket={bucket} current={data.website} />;
    case "cors":
      return <JsonEditor bucket={bucket} kind="cors" current={data.cors.json} />;
    case "policy":
      return <JsonEditor bucket={bucket} kind="policy" current={data.policy.document} />;
  }
}

function useSave(bucket: string) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdatePropertyInput) => api.updateProperty(bucket, input),
    onSuccess: () => {
      toast.success(t("props.applied"));
      qc.invalidateQueries({ queryKey: ["properties", bucket] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-xs font-medium uppercase text-slate-500">{children}</div>;
}

function VersioningEditor({ bucket, current }: { bucket: string; current: VersioningStatus }) {
  const { t } = useTranslation();
  const save = useSave(bucket);
  const [status, setStatus] = useState<"Enabled" | "Suspended">(
    current === "Enabled" ? "Enabled" : "Suspended",
  );
  useEffect(() => setStatus(current === "Enabled" ? "Enabled" : "Suspended"), [current]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>{t("props.currentState")}</FieldLabel>
        <span className="text-sm text-slate-700">{current}</span>
      </div>
      <div>
        <FieldLabel>{t("props.versioning.label")}</FieldLabel>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "Enabled" | "Suspended")}
          className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
        >
          <option value="Enabled">Enabled</option>
          <option value="Suspended">Suspended</option>
        </select>
        <p className="mt-1 text-xs text-slate-400">{t("props.versioning.note")}</p>
      </div>
      <Button
        className="self-start"
        loading={save.isPending}
        onClick={() => save.mutate({ section: "versioning", value: { status } })}
      >
        {t("common.apply")}
      </Button>
    </div>
  );
}

function TaggingEditor({ bucket, current }: { bucket: string; current: Tag[] }) {
  const { t } = useTranslation();
  const save = useSave(bucket);
  const [tags, setTags] = useState<Tag[]>(current);
  useEffect(() => setTags(current), [current]);

  const update = (i: number, patch: Partial<Tag>) =>
    setTags((prev) => prev.map((tg, idx) => (idx === i ? { ...tg, ...patch } : tg)));

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel>{t("props.tagging.count", { count: tags.length })}</FieldLabel>
      <div className="flex flex-col gap-2">
        {tags.map((tg, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: order-based editable rows
          <div key={i} className="flex items-center gap-2">
            <input
              value={tg.key}
              onChange={(e) => update(i, { key: e.target.value })}
              placeholder="Key"
              className="w-40 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
            <input
              value={tg.value}
              onChange={(e) => update(i, { value: e.target.value })}
              placeholder="Value"
              className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-sm outline-none focus:border-brand"
            />
            <button
              type="button"
              onClick={() => setTags((prev) => prev.filter((_, idx) => idx !== i))}
              className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {tags.length === 0 && <p className="text-sm text-slate-400">{t("props.tagging.none")}</p>}
      </div>
      <Button
        variant="secondary"
        className="self-start"
        onClick={() => setTags((p) => [...p, { key: "", value: "" }])}
      >
        <Plus className="h-4 w-4" /> {t("props.tagging.addTag")}
      </Button>
      <div>
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              section: "tagging",
              value: { tags: tags.filter((tg) => tg.key.trim() !== "") },
            })
          }
        >
          {t("common.apply")}
        </Button>
        <span className="ml-2 text-xs text-slate-400">{t("props.tagging.emptyDeletes")}</span>
      </div>
    </div>
  );
}

function EncryptionEditor({
  bucket,
  current,
}: {
  bucket: string;
  current: BucketProperties["encryption"];
}) {
  const { t } = useTranslation();
  const save = useSave(bucket);
  const [enabled, setEnabled] = useState(current.enabled);
  const [algorithm, setAlgorithm] = useState<"AES256" | "aws:kms">(current.algorithm ?? "AES256");
  useEffect(() => {
    setEnabled(current.enabled);
    setAlgorithm(current.algorithm ?? "AES256");
  }, [current]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>{t("props.currentState")}</FieldLabel>
        <span className="text-sm text-slate-700">
          {current.enabled
            ? t("props.encryption.enabledWith", { algorithm: current.algorithm })
            : t("props.encryption.disabled")}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t("props.encryption.use")}
      </label>
      {enabled && (
        <div>
          <FieldLabel>{t("props.encryption.algorithm")}</FieldLabel>
          <select
            value={algorithm}
            onChange={(e) => setAlgorithm(e.target.value as "AES256" | "aws:kms")}
            className="w-56 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="AES256">AES256 (SSE-S3)</option>
            <option value="aws:kms">aws:kms (SSE-KMS)</option>
          </select>
        </div>
      )}
      <Button
        className="self-start"
        loading={save.isPending}
        onClick={() => save.mutate({ section: "encryption", value: { enabled, algorithm } })}
      >
        {t("common.apply")}
      </Button>
    </div>
  );
}

function WebsiteEditor({ bucket, current }: { bucket: string; current: WebsiteConfig }) {
  const { t } = useTranslation();
  const save = useSave(bucket);
  const [enabled, setEnabled] = useState(current.enabled);
  const [index, setIndex] = useState(current.indexDocument || "index.html");
  const [error, setError] = useState(current.errorDocument);
  useEffect(() => {
    setEnabled(current.enabled);
    setIndex(current.indexDocument || "index.html");
    setError(current.errorDocument);
  }, [current]);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <FieldLabel>{t("props.currentState")}</FieldLabel>
        <span className="text-sm text-slate-700">
          {current.enabled
            ? t("props.website.enabledWith", { index: current.indexDocument || "-" })
            : t("props.website.disabled")}
        </span>
      </div>
      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        {t("props.website.use")}
      </label>
      {enabled && (
        <>
          <div>
            <FieldLabel>{t("props.website.indexDocument")}</FieldLabel>
            <input
              value={index}
              onChange={(e) => setIndex(e.target.value)}
              placeholder="index.html"
              className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
          <div>
            <FieldLabel>{t("props.website.errorDocument")}</FieldLabel>
            <input
              value={error}
              onChange={(e) => setError(e.target.value)}
              placeholder="error.html"
              className="w-72 rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand"
            />
          </div>
        </>
      )}
      {current.enabled && current.endpoint && (
        <div>
          <FieldLabel>{t("props.website.endpoint")}</FieldLabel>
          <a
            href={current.endpoint}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-xs text-brand hover:underline"
          >
            {current.endpoint}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
      <div>
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              section: "website",
              value: { enabled, indexDocument: index, errorDocument: error },
            })
          }
        >
          {t("common.apply")}
        </Button>
        <span className="ml-2 text-xs text-slate-400">{t("props.website.publicNote")}</span>
      </div>
    </div>
  );
}

const CORS_EXAMPLE = `[
  {
    "AllowedMethods": ["GET", "PUT"],
    "AllowedOrigins": ["*"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3000
  }
]`;

const POLICY_EXAMPLE = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicRead",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::BUCKET/*"
    }
  ]
}`;

function JsonEditor({
  bucket,
  kind,
  current,
}: {
  bucket: string;
  kind: "cors" | "policy";
  current: string | null;
}) {
  const { t } = useTranslation();
  const save = useSave(bucket);
  const [text, setText] = useState(current ?? "");
  useEffect(() => setText(current ?? ""), [current]);

  const example = kind === "cors" ? CORS_EXAMPLE : POLICY_EXAMPLE;

  const handleSave = () => {
    if (kind === "cors") {
      save.mutate({ section: "cors", value: { json: text.trim() ? text : null } });
    } else {
      save.mutate({ section: "policy", value: { document: text.trim() ? text : null } });
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <FieldLabel>{t(`props.${kind}.label`)}</FieldLabel>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        spellCheck={false}
        placeholder={example}
        className="h-72 w-full resize-none rounded-md border border-slate-300 p-3 font-mono text-xs leading-relaxed outline-none focus:border-brand"
      />
      <p className="text-xs text-slate-400">{t(`props.${kind}.hint`)}</p>
      <div className="flex items-center gap-2">
        <Button loading={save.isPending} onClick={handleSave}>
          {t("common.apply")}
        </Button>
        <Button variant="ghost" onClick={() => setText(example)}>
          {t(`props.${kind}.fillExample`)}
        </Button>
      </div>
    </div>
  );
}
