import { useQueryClient } from "@tanstack/react-query";
import { Boxes, Check, Copy, Info, RadioTower } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { type Candidate, type DetectResult, detectBackend, discoverCandidates } from "@/lib/detect";
import { type BackendKind, type ConnectionSettings, settingsSchema } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { Button, Field, TextInput } from "./ui";

// Guide link that respects the base path (e.g. a GitHub Pages sub-path)
const README_URL = `${import.meta.env.BASE_URL}readme.html#setup`;
// The current origin that must be allowed in CORS
const ORIGIN = window.location.origin;

function OriginCopy() {
  const [copied, setCopied] = useState(false);
  return (
    <span className="inline-flex items-center gap-1 rounded border border-red-300 bg-white px-1.5 py-0.5">
      <code className="break-all text-red-700">{ORIGIN}</code>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(ORIGIN);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            /* ignore */
          }
        }}
        className="text-red-400 hover:text-red-700"
      >
        {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3" />}
      </button>
    </span>
  );
}

const BADGE: Record<BackendKind, string> = {
  localstack: "bg-violet-100 text-violet-700",
  minio: "bg-sky-100 text-sky-700",
  aws: "bg-amber-100 text-amber-700",
  unknown: "bg-slate-100 text-slate-600",
  none: "bg-slate-100 text-slate-500",
};

function BackendBadge({ backend }: { backend: BackendKind }) {
  const { t } = useTranslation();
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium", BADGE[backend])}>
      {t(`backend.${backend}`)}
    </span>
  );
}

export function ConnectionDialog({
  mode,
  open,
  onClose,
}: {
  mode: "setup" | "settings";
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const stored = useSettings((s) => s.settings);
  const confirm = useSettings((s) => s.confirm);
  const reset = useSettings((s) => s.reset);

  const [form, setForm] = useState<ConnectionSettings>(stored);
  const [discovering, setDiscovering] = useState(false);
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<DetectResult | null>(null);

  const tested = testResult?.reachable === true;

  // Editing the form invalidates the test result -> must re-test before connecting
  const set = <K extends keyof ConnectionSettings>(k: K, v: ConnectionSettings[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setTestResult(null);
  };

  const runDiscover = async () => {
    setDiscovering(true);
    try {
      setCandidates(await discoverCandidates());
    } finally {
      setDiscovering(false);
    }
  };

  const applyCandidate = (c: Candidate) => {
    setForm((f) => ({ ...f, ...c.defaults }));
    setTestResult(null);
  };

  const runTest = async () => {
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) return;
    setTesting(true);
    try {
      setTestResult(await detectBackend(parsed.data));
    } finally {
      setTesting(false);
    }
  };

  // On open: reset the form and auto-discover candidates
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only when "open" toggles
  useEffect(() => {
    if (!open) return;
    setForm(stored);
    setTestResult(null);
    setCandidates(null);
    void runDiscover();
  }, [open]);

  if (!open) return null;

  const handleConnect = () => {
    if (!tested || !testResult) return;
    const parsed = settingsSchema.safeParse(form);
    if (!parsed.success) return;
    // Clear cached bucket/object lists since the backend or credentials may have changed
    qc.clear();
    confirm(parsed.data, testResult.backend);
    onClose();
  };

  const dismissable = mode === "settings";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="close"
        className="absolute inset-0 bg-black/50"
        onClick={dismissable ? onClose : undefined}
      />
      <div className="relative z-10 flex max-h-[92vh] w-full max-w-xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex items-center gap-2 border-b px-5 py-4">
          <Boxes className="h-6 w-6 text-brand" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-slate-800">
              {mode === "setup" ? t("setup.title") : t("settings.title")}
            </h2>
            {mode === "setup" && <p className="text-xs text-slate-500">{t("setup.intro")}</p>}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-auto p-5">
          {/* Candidate discovery (above the endpoint field) */}
          <div className="rounded-md border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center gap-3">
              <Button variant="secondary" onClick={runDiscover} loading={discovering}>
                <RadioTower className="h-4 w-4" />
                {t("settings.detect")}
              </Button>
              <span className="text-xs text-slate-500">
                {discovering ? t("settings.detecting") : t("settings.discoverHint")}
              </span>
            </div>
            {!discovering && candidates && (
              <div className="mt-2.5 flex flex-wrap gap-2">
                {candidates.length === 0 ? (
                  <span className="text-xs text-slate-400">{t("settings.noCandidates")}</span>
                ) : (
                  candidates.map((c) => (
                    <button
                      key={c.endpoint}
                      type="button"
                      onClick={() => applyCandidate(c)}
                      className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs hover:border-brand hover:bg-brand-fg"
                    >
                      <BackendBadge backend={c.backend} />
                      <code className="text-slate-500">{c.endpoint}</code>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <Field label={t("settings.endpoint")}>
            <TextInput
              value={form.endpoint}
              onChange={(e) => set("endpoint", e.target.value)}
              placeholder="http://localhost:4566"
            />
            <span className="text-xs text-slate-400">{t("settings.endpointHint")}</span>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.region")}>
              <TextInput value={form.region} onChange={(e) => set("region", e.target.value)} />
            </Field>
            <Field label={t("settings.websiteEndpoint")}>
              <TextInput
                value={form.websiteHost}
                onChange={(e) => set("websiteHost", e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label={t("settings.accessKeyId")}>
              <TextInput
                value={form.accessKeyId}
                onChange={(e) => set("accessKeyId", e.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label={t("settings.secretAccessKey")}>
              <TextInput
                type="password"
                value={form.secretAccessKey}
                onChange={(e) => set("secretAccessKey", e.target.value)}
                autoComplete="off"
              />
            </Field>
          </div>
          <p className="text-xs text-amber-600">{t("settings.credsHint")}</p>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.forcePathStyle}
              onChange={(e) => set("forcePathStyle", e.target.checked)}
            />
            {t("settings.forcePathStyle")}
            <span className="text-xs text-slate-400">— {t("settings.forcePathStyleHint")}</span>
          </label>

          {/* Connection test result (success is shown on the test button below) */}
          {testResult && !testResult.reachable && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
              <div className="flex items-center gap-2">
                <span className="flex-1">
                  {testResult.failure === "credentials"
                    ? t("settings.errCreds")
                    : testResult.failure === "cors"
                      ? t("settings.corsFixShort")
                      : t("settings.errOther")}
                </span>
                {testResult.failure === "cors" && (
                  <a
                    href={README_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 rounded border border-red-300 bg-white px-2 py-1 font-medium text-red-700 hover:bg-red-100"
                  >
                    {t("common.learnMore")}
                  </a>
                )}
              </div>
              {testResult.failure === "cors" && (
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span>{t("settings.allowOrigin")}</span>
                  <OriginCopy />
                </div>
              )}
              {testResult.detail && (
                <code className="mt-1.5 block break-all text-[11px] text-red-500/80">
                  {testResult.detail}
                </code>
              )}
            </div>
          )}

          {/* Info notice */}
          <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
            <Info className="h-4 w-4 shrink-0 text-slate-400" />
            <span className="flex-1">{t("settings.noticeShort")}</span>
            <a
              href={README_URL}
              target="_blank"
              rel="noreferrer"
              className="shrink-0 rounded border border-slate-300 bg-white px-2 py-1 font-medium text-slate-600 hover:bg-slate-100"
            >
              {t("common.learnMore")}
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between border-t px-5 py-3">
          {mode === "settings" ? (
            <Button variant="ghost" onClick={reset}>
              {t("settings.reset")}
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {dismissable && (
              <Button variant="secondary" onClick={onClose}>
                {t("common.cancel")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={runTest}
              loading={testing}
              className={
                tested
                  ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100"
                  : undefined
              }
            >
              {tested ? (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  {t("settings.testOk")}
                </>
              ) : (
                t("settings.testConnection")
              )}
            </Button>
            <Button
              onClick={handleConnect}
              disabled={!tested}
              title={!tested ? t("settings.testFirst") : undefined}
            >
              {mode === "setup" ? t("setup.confirm") : t("common.save")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
