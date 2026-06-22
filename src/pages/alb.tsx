import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Network, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  DetailHeader,
  PageHeader,
  ResourceTable,
  SectionTitle,
  StatusBadge,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { TagsEditor } from "@/components/tags-editor";
import { useToast } from "@/components/toast";
import {
  Button,
  CONTROL_CLASS,
  Field,
  FieldLabel,
  FormCard,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";
import { api as ec2 } from "@/lib/ec2-api";
import { api } from "@/lib/elbv2-api";
import type { AlbListenerDetail, AlbSummary, TargetGroupSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AlbPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AlbSummary | null>(null);

  const lbs = useQuery({ queryKey: ["load-balancers"], queryFn: api.listLoadBalancers });

  const del = useMutation({
    mutationFn: (arn: string) => api.deleteLoadBalancer(arn),
    onSuccess: () => {
      toast.success(t("alb.deleted"));
      qc.invalidateQueries({ queryKey: ["load-balancers"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Network}
        title={t("alb.heading")}
        subtitle={t("alb.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["load-balancers"] })}
        refreshing={lbs.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("alb.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={lbs.isLoading}
          isError={lbs.isError}
          error={lbs.error}
          service="ELBv2 (load balancers)"
          data={lbs.data}
          getKey={(lb) => lb.arn}
          empty={{ icon: Network, message: t("alb.none") }}
          head={
            <tr>
              <Th>{t("alb.col.name")}</Th>
              <Th>{t("alb.col.type")}</Th>
              <Th>{t("alb.col.scheme")}</Th>
              <Th>{t("alb.col.state")}</Th>
              <Th>{t("alb.col.dns")}</Th>
              <Th>{t("alb.col.vpc")}</Th>
              <Th>{t("alb.col.created")}</Th>
              <Th />
            </tr>
          }
          row={(lb: AlbSummary) => (
            <Tr key={lb.arn} onClick={() => navigate(encodeURIComponent(lb.name))}>
              <Td className="font-medium text-brand hover:underline">{lb.name}</Td>
              <Td>{lb.type ?? "—"}</Td>
              <Td>{lb.scheme ?? "—"}</Td>
              <Td>{lb.state ?? "—"}</Td>
              <Td mono>{lb.dnsName ?? "—"}</Td>
              <Td mono>{lb.vpcId ?? "—"}</Td>
              <Td muted>{formatDate(lb.createdTime, i18n.language)}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(lb);
                  }}
                  className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </Td>
            </Tr>
          )}
        />
      </div>

      <CreateAlbModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("alb.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("alb.deleteConfirm", { name: deleteTarget?.name })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.arn)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

export function AlbDetailPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const { lbName = "" } = useParams();
  const name = decodeURIComponent(lbName);

  const lbs = useQuery({ queryKey: ["load-balancers"], queryFn: api.listLoadBalancers });
  const lb = lbs.data?.find((x) => x.name === name) ?? null;

  const listeners = useQuery({
    queryKey: ["listeners", lb?.arn],
    queryFn: () => api.getListeners(lb?.arn ?? ""),
    enabled: Boolean(lb?.arn),
  });
  const tgs = useQuery({ queryKey: ["target-groups"], queryFn: api.listTargetGroups });

  const [protocol, setProtocol] = useState("HTTP");
  const [port, setPort] = useState("80");
  const [actionType, setActionType] = useState<"forward" | "fixed-response">("forward");
  const [tgArn, setTgArn] = useState("");
  const [statusCode, setStatusCode] = useState("404");
  const [body, setBody] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["listeners", lb?.arn] });

  const addListener = useMutation({
    mutationFn: () =>
      api.createListener({
        loadBalancerArn: lb?.arn ?? "",
        protocol,
        port: Number(port) || 80,
        action:
          actionType === "forward"
            ? { type: "forward", targetGroupArn: tgArn }
            : { type: "fixed-response", statusCode, contentType: "text/plain", body },
      }),
    onSuccess: () => {
      toast.success(t("alb.listenerCreated"));
      setTgArn("");
      setBody("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const canAdd =
    port.trim() !== "" && (actionType === "forward" ? tgArn !== "" : statusCode.trim() !== "");

  const delListener = useMutation({
    mutationFn: (arn: string) => api.deleteListener(arn),
    onSuccess: () => {
      toast.success(t("alb.listenerDeleted"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        title={name}
        meta={`${lb?.type ?? ""}${lb?.scheme ? ` · ${lb.scheme}` : ""}${
          lb?.dnsName ? ` · ${lb.dnsName}` : ""
        }`}
        onBack={() => navigate("/compute/load-balancers")}
        backTitle={t("common.back")}
        actions={<span className="text-xs text-slate-500">{t("alb.listeners")}</span>}
        onRefresh={refresh}
        refreshing={listeners.isFetching}
        refreshTitle={t("common.refresh")}
      />
      <div className="flex-1 overflow-auto p-4">
        {lb && <AlbAttributesSection lb={lb} />}

        <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("alb.listeners")}
        </div>
        {/* create listener */}
        <FormCard title={t("alb.addListener")} className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("alb.col.type")}</FieldLabel>
              <Select
                value={protocol}
                onChange={(e) => setProtocol(e.target.value)}
                className="w-24 py-1.5"
              >
                {["HTTP", "HTTPS", "TCP"].map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("tg.port")}</FieldLabel>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={t("tg.port")}
                className={cn(CONTROL_CLASS, "w-24 py-1.5")}
              />
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("alb.actions")}</FieldLabel>
              <Select
                value={actionType}
                onChange={(e) => setActionType(e.target.value as "forward" | "fixed-response")}
                className="py-1.5"
              >
                <option value="forward">{t("alb.actionForward")}</option>
                <option value="fixed-response">{t("alb.actionFixed")}</option>
              </Select>
            </label>
            {actionType === "forward" ? (
              // biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label
              <label className="flex flex-1 flex-col gap-1.5">
                <FieldLabel>{t("compute.targetGroups")}</FieldLabel>
                <Select
                  value={tgArn}
                  onChange={(e) => setTgArn(e.target.value)}
                  className="w-full min-w-[10rem] py-1.5"
                >
                  <option value="">{t("alb.pickTargetGroup")}</option>
                  {(tgs.data ?? []).map((tg) => (
                    <option key={tg.arn} value={tg.arn}>
                      {tg.name}
                    </option>
                  ))}
                </Select>
              </label>
            ) : (
              <>
                <label className="flex flex-col gap-1.5">
                  <FieldLabel>{t("tg.health.state")}</FieldLabel>
                  <input
                    value={statusCode}
                    onChange={(e) => setStatusCode(e.target.value)}
                    placeholder="404"
                    className={cn(CONTROL_CLASS, "w-20 py-1.5")}
                  />
                </label>
                <label className="flex flex-1 flex-col gap-1.5">
                  <FieldLabel>{t("alb.responseBody")}</FieldLabel>
                  <input
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                    placeholder={t("alb.responseBody")}
                    className={cn(CONTROL_CLASS, "w-full min-w-[10rem] py-1.5")}
                  />
                </label>
              </>
            )}
            <Button
              loading={addListener.isPending}
              disabled={!canAdd}
              onClick={() => addListener.mutate()}
            >
              <Plus className="h-3.5 w-3.5" /> {t("alb.addListener")}
            </Button>
          </div>
        </FormCard>

        {listeners.isLoading ? (
          <TableLoading />
        ) : listeners.isError ? (
          <p className="text-sm text-red-600">{(listeners.error as Error).message}</p>
        ) : listeners.data && listeners.data.length > 0 ? (
          <div className="flex flex-col gap-5">
            {listeners.data.map((l: AlbListenerDetail) => (
              <ListenerCard
                key={l.arn}
                listener={l}
                targetGroups={tgs.data ?? []}
                onDeleteListener={() => delListener.mutate(l.arn)}
                onChanged={refresh}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("alb.noListeners")}</p>
        )}
      </div>
    </div>
  );
}

/** Load-balancer attributes (idle timeout / deletion protection / http2) + tags. */
function AlbAttributesSection({ lb }: { lb: AlbSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const attrs = useQuery({
    queryKey: ["lb-attributes", lb.arn],
    queryFn: () => api.getLoadBalancerAttributes(lb.arn),
  });
  const tags = useQuery({ queryKey: ["lb-tags", lb.arn], queryFn: () => api.getTags(lb.arn) });

  const [idle, setIdle] = useState(60);
  const [delProt, setDelProt] = useState(false);
  const [http2, setHttp2] = useState(true);
  useEffect(() => {
    if (attrs.data) {
      setIdle(attrs.data.idleTimeoutSeconds);
      setDelProt(attrs.data.deletionProtection);
      setHttp2(attrs.data.http2Enabled);
    }
  }, [attrs.data]);

  const saveAttrs = useMutation({
    mutationFn: () =>
      api.modifyLoadBalancerAttributes(lb.arn, {
        idleTimeoutSeconds: idle,
        deletionProtection: delProt,
        http2Enabled: http2,
      }),
    onSuccess: () => toast.success(t("alb.attrsSaved")),
    onError: (e) => toast.error((e as Error).message),
  });

  const qc = useQueryClient();
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(lb.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["lb-tags", lb.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Card className="flex flex-col gap-5">
      <div>
        <SectionTitle>{t("alb.attributes")}</SectionTitle>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("alb.idleTimeout")}</FieldLabel>
            <input
              type="number"
              min={1}
              value={idle}
              onChange={(e) => setIdle(Math.max(1, Number(e.target.value) || 1))}
              className={cn(CONTROL_CLASS, "w-28 py-1.5")}
            />
          </label>
          <label className="flex items-center gap-2 self-center text-sm text-slate-700">
            <input
              type="checkbox"
              checked={delProt}
              onChange={(e) => setDelProt(e.target.checked)}
            />
            {t("alb.deletionProtection")}
          </label>
          <label className="flex items-center gap-2 self-center text-sm text-slate-700">
            <input type="checkbox" checked={http2} onChange={(e) => setHttp2(e.target.checked)} />
            {t("alb.http2")}
          </label>
          <Button
            variant="secondary"
            className="ml-auto"
            loading={saveAttrs.isPending}
            onClick={() => saveAttrs.mutate()}
          >
            {t("common.apply")}
          </Button>
        </div>
      </div>

      <div>
        <SectionTitle>{t("tags.heading")}</SectionTitle>
        <TagsEditor
          current={tags.data ?? []}
          saving={saveTags.isPending}
          onSave={(tg, removed) => saveTags.mutate({ tags: tg, removed })}
        />
      </div>
    </Card>
  );
}

function ListenerCard({
  listener,
  targetGroups,
  onDeleteListener,
  onChanged,
}: {
  listener: AlbListenerDetail;
  targetGroups: TargetGroupSummary[];
  onDeleteListener: () => void;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [showTags, setShowTags] = useState(false);
  const [priority, setPriority] = useState("10");
  const [field, setField] = useState<"path-pattern" | "host-header">("path-pattern");
  const [values, setValues] = useState("");
  const [tgArn, setTgArn] = useState("");

  const tags = useQuery({
    queryKey: ["listener-tags", listener.arn],
    queryFn: () => api.getTags(listener.arn),
    enabled: showTags,
  });
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(listener.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["listener-tags", listener.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const addRule = useMutation({
    mutationFn: () =>
      api.createRule({
        listenerArn: listener.arn,
        priority: Number(priority) || 1,
        conditionField: field,
        values,
        targetGroupArn: tgArn,
      }),
    onSuccess: () => {
      toast.success(t("alb.ruleCreated"));
      setValues("");
      setTgArn("");
      setAdding(false);
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const delRule = useMutation({
    mutationFn: (ruleArn: string) => api.deleteRule(ruleArn),
    onSuccess: () => {
      toast.success(t("alb.ruleDeleted"));
      onChanged();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900">
        {listener.protocol}:{listener.port}
        <span className="text-xs font-normal text-slate-500">
          {t("alb.defaultAction")}: {listener.defaultActionType ?? "—"}
        </span>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-xs font-normal text-brand hover:underline"
        >
          + {t("alb.addRule")}
        </button>
        <button
          type="button"
          onClick={() => setShowTags((v) => !v)}
          className="text-xs font-normal text-brand hover:underline"
        >
          {t("tags.heading")}
        </button>
        <button
          type="button"
          title={t("alb.deleteListener")}
          onClick={onDeleteListener}
          className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {showTags && (
        <Card title={t("tags.heading")} className="mb-3">
          <TagsEditor
            current={tags.data ?? []}
            saving={saveTags.isPending}
            onSave={(tg, removed) => saveTags.mutate({ tags: tg, removed })}
          />
        </Card>
      )}

      {adding && (
        <FormCard title={t("alb.addRule")} className="mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("alb.priority")}</FieldLabel>
              <input
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                placeholder={t("alb.priority")}
                className={cn(CONTROL_CLASS, "w-20 py-1.5")}
              />
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("alb.conditions")}</FieldLabel>
              <Select
                value={field}
                onChange={(e) => setField(e.target.value as "path-pattern" | "host-header")}
                className="py-1.5"
              >
                <option value="path-pattern">path</option>
                <option value="host-header">host</option>
              </Select>
            </label>
            <label className="flex flex-1 flex-col gap-1.5">
              <FieldLabel>{field === "path-pattern" ? "/api/*" : "api.example.com"}</FieldLabel>
              <input
                value={values}
                onChange={(e) => setValues(e.target.value)}
                placeholder={field === "path-pattern" ? "/api/*" : "api.example.com"}
                className={cn(CONTROL_CLASS, "w-full min-w-[10rem] py-1.5 font-mono")}
              />
            </label>
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
            <label className="flex flex-1 flex-col gap-1.5">
              <FieldLabel>{t("compute.targetGroups")}</FieldLabel>
              <Select
                value={tgArn}
                onChange={(e) => setTgArn(e.target.value)}
                className="w-full min-w-[10rem] py-1.5"
              >
                <option value="">{t("alb.pickTargetGroup")}</option>
                {targetGroups.map((tg) => (
                  <option key={tg.arn} value={tg.arn}>
                    {tg.name}
                  </option>
                ))}
              </Select>
            </label>
            <Button
              loading={addRule.isPending}
              disabled={!values.trim() || !tgArn || !priority.trim()}
              onClick={() => addRule.mutate()}
            >
              {t("common.add")}
            </Button>
          </div>
        </FormCard>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="w-20 px-3 py-2 font-semibold">{t("alb.priority")}</th>
              <th className="px-3 py-2 font-semibold">{t("alb.conditions")}</th>
              <th className="px-3 py-2 font-semibold">{t("alb.actions")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {listener.rules.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules ordered, no stable id
              <tr key={i} className="align-top hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">
                  {r.isDefault ? (
                    <StatusBadge tone="neutral">{r.priority}</StatusBadge>
                  ) : (
                    r.priority
                  )}
                </td>
                <td className="px-3 py-2 font-mono text-slate-600">
                  {r.conditions.length ? r.conditions.join("; ") : "—"}
                </td>
                <td className="px-3 py-2 font-mono text-slate-600">
                  {r.actions.length ? r.actions.join("; ") : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {!r.isDefault && (
                    <button
                      type="button"
                      title={t("alb.deleteRule")}
                      onClick={() => delRule.mutate(r.arn)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateAlbModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [scheme, setScheme] = useState<"internet-facing" | "internal">("internet-facing");
  const [type, setType] = useState<"application" | "network">("application");
  const [subnetIds, setSubnetIds] = useState<string[]>([]);
  const [sgIds, setSgIds] = useState<string[]>([]);

  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const sgs = useQuery({
    queryKey: ["security-groups"],
    queryFn: ec2.listSecurityGroups,
    enabled: open,
  });

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = useMutation({
    mutationFn: () =>
      api.createLoadBalancer({
        name: name.trim(),
        scheme,
        type,
        subnetIds,
        securityGroupIds: sgIds,
      }),
    onSuccess: () => {
      toast.success(t("alb.created", { name }));
      qc.invalidateQueries({ queryKey: ["load-balancers"] });
      setName("");
      setSubnetIds([]);
      setSgIds([]);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("alb.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("alb.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("alb.col.type")}>
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as "application" | "network")}
            >
              <option value="application">application</option>
              <option value="network">network</option>
            </Select>
          </Field>
          <Field label={t("alb.col.scheme")}>
            <Select
              value={scheme}
              onChange={(e) => setScheme(e.target.value as "internet-facing" | "internal")}
            >
              <option value="internet-facing">internet-facing</option>
              <option value="internal">internal</option>
            </Select>
          </Field>
        </div>

        <Field label={t("alb.subnets")}>
          <div className="max-h-28 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
            {(subnets.data ?? []).map((s) => (
              <label
                key={s.subnetId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
                  subnetIds.includes(s.subnetId) && "bg-brand-fg hover:bg-brand-tint",
                )}
              >
                <input
                  type="checkbox"
                  checked={subnetIds.includes(s.subnetId)}
                  onChange={() => toggle(setSubnetIds, s.subnetId)}
                />
                <span className="font-mono text-slate-700">{s.subnetId}</span>
                <span className="text-slate-500">{s.availabilityZone}</span>
              </label>
            ))}
          </div>
          <span className="text-xs text-slate-500">{t("alb.subnetsHint")}</span>
        </Field>

        <Field label={t("ec2.launch.securityGroups")}>
          <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
            {(sgs.data ?? []).map((g) => (
              <label
                key={g.groupId}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
                  sgIds.includes(g.groupId) && "bg-brand-fg hover:bg-brand-tint",
                )}
              >
                <input
                  type="checkbox"
                  checked={sgIds.includes(g.groupId)}
                  onChange={() => toggle(setSgIds, g.groupId)}
                />
                <span className="font-medium text-slate-800">{g.groupName}</span>
                <span className="font-mono text-slate-500">{g.groupId}</span>
              </label>
            ))}
          </div>
        </Field>

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || subnetIds.length === 0}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
