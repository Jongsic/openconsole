import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Target, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PageHeader,
  PanelHeader,
  ResourceTable,
  StatusBadge,
  type StatusTone,
  Table,
  TableLoading,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
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
import type { TargetGroupSummary, TargetHealthEntry } from "@/lib/types";
import { cn } from "@/lib/utils";

const HEALTH_TONES: Record<string, StatusTone> = {
  healthy: "green",
  unhealthy: "red",
  initial: "amber",
  draining: "neutral",
  unused: "neutral",
};

export function TargetGroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TargetGroupSummary | null>(null);

  const tgs = useQuery({ queryKey: ["target-groups"], queryFn: api.listTargetGroups });
  const current = tgs.data?.find((tg) => tg.arn === selected) ?? null;

  const del = useMutation({
    mutationFn: (arn: string) => api.deleteTargetGroup(arn),
    onSuccess: (_d, arn) => {
      toast.success(t("tg.deleted"));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
      if (selected === arn) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Target}
        title={t("tg.heading")}
        subtitle={t("tg.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["target-groups"] })}
        refreshing={tgs.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("tg.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={tgs.isLoading}
          isError={tgs.isError}
          error={tgs.error}
          service="ELBv2 target groups"
          data={tgs.data}
          getKey={(tg) => tg.arn}
          empty={{ icon: Target, message: t("tg.none") }}
          head={
            <tr>
              <Th>{t("tg.col.name")}</Th>
              <Th>{t("tg.col.protocol")}</Th>
              <Th>{t("tg.col.targetType")}</Th>
              <Th>{t("tg.col.vpc")}</Th>
              <Th>{t("tg.col.healthCheck")}</Th>
              <Th>{t("tg.col.loadBalancers")}</Th>
              <Th />
            </tr>
          }
          row={(tg: TargetGroupSummary) => (
            <Tr key={tg.arn} onClick={() => setSelected(tg.arn)} selected={selected === tg.arn}>
              <Td className="font-medium text-slate-700">{tg.name}</Td>
              <Td>
                {tg.protocol ?? "—"}
                {tg.port != null ? `:${tg.port}` : ""}
              </Td>
              <Td>{tg.targetType ?? "—"}</Td>
              <Td mono>{tg.vpcId ?? "—"}</Td>
              <Td muted>
                {tg.healthCheckProtocol ?? "—"} {tg.healthCheckPath ?? ""}
              </Td>
              <Td>{tg.loadBalancerArns.length}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(tg);
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

      {current && <HealthPanel key={current.arn} tg={current} onClose={() => setSelected(null)} />}

      <CreateTgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("tg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("tg.deleteConfirm", { name: deleteTarget?.name })}</p>
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

/** Health-check summary (read-only) + editable attributes (stickiness / dereg delay / algorithm). */
function TgAttributes({ tg }: { tg: TargetGroupSummary }) {
  const { t } = useTranslation();
  const toast = useToast();
  const attrs = useQuery({
    queryKey: ["tg-attributes", tg.arn],
    queryFn: () => api.getTargetGroupAttributes(tg.arn),
  });

  const [stickiness, setStickiness] = useState(false);
  const [duration, setDuration] = useState(86400);
  const [dereg, setDereg] = useState(300);
  const [algo, setAlgo] = useState("round_robin");
  // sync once data arrives
  useEffect(() => {
    if (attrs.data) {
      setStickiness(attrs.data.stickinessEnabled);
      setDuration(attrs.data.stickinessDurationSeconds);
      setDereg(attrs.data.deregistrationDelaySeconds);
      setAlgo(attrs.data.loadBalancingAlgorithm);
    }
  }, [attrs.data]);

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: () =>
      api.modifyTargetGroupAttributes(tg.arn, {
        stickinessEnabled: stickiness,
        stickinessType: attrs.data?.stickinessType ?? "lb_cookie",
        stickinessDurationSeconds: duration,
        deregistrationDelaySeconds: dereg,
        loadBalancingAlgorithm: algo,
      }),
    onSuccess: () => toast.success(t("tg.attrsSaved")),
    onError: (e) => toast.error((e as Error).message),
  });

  // Health-check editor (ModifyTargetGroup) — only meaningful for HTTP/HTTPS target groups.
  const isHttp = (tg.healthCheckProtocol ?? "").startsWith("HTTP");
  const [hcPath, setHcPath] = useState(tg.healthCheckPath ?? "/");
  const [hcInterval, setHcInterval] = useState(tg.healthCheckIntervalSeconds ?? 30);
  const [hcTimeout, setHcTimeout] = useState(tg.healthCheckTimeoutSeconds ?? 5);
  const [hcHealthy, setHcHealthy] = useState(tg.healthyThreshold ?? 5);
  const [hcUnhealthy, setHcUnhealthy] = useState(tg.unhealthyThreshold ?? 2);
  const [hcMatcher, setHcMatcher] = useState(tg.matcherHttpCode ?? "200");

  const saveHc = useMutation({
    mutationFn: () =>
      api.modifyHealthCheck(tg.arn, {
        path: hcPath,
        intervalSeconds: hcInterval,
        timeoutSeconds: hcTimeout,
        healthyThreshold: hcHealthy,
        unhealthyThreshold: hcUnhealthy,
        matcherHttpCode: hcMatcher,
      }),
    onSuccess: () => {
      toast.success(t("tg.hcSaved"));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const tags = useQuery({ queryKey: ["tg-tags", tg.arn], queryFn: () => api.getTags(tg.arn) });
  const saveTags = useMutation({
    mutationFn: (v: { tags: { key: string; value: string }[]; removed: string[] }) =>
      api.saveTags(tg.arn, v.tags, v.removed),
    onSuccess: () => {
      toast.success(t("tags.saved"));
      qc.invalidateQueries({ queryKey: ["tg-tags", tg.arn] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const numCls = cn(CONTROL_CLASS, "w-20 py-1.5");

  return (
    <div className="mb-4 flex flex-col gap-4">
      <FormCard title={t("tg.healthCheck")}>
        <div className="flex flex-wrap items-end gap-3">
          {isHttp && (
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("tg.hcPath")}</FieldLabel>
              <input
                value={hcPath}
                onChange={(e) => setHcPath(e.target.value)}
                className={cn(CONTROL_CLASS, "w-32 py-1.5 font-mono")}
              />
            </label>
          )}
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.hcInterval")}</FieldLabel>
            <input
              type="number"
              min={1}
              value={hcInterval}
              onChange={(e) => setHcInterval(Math.max(1, Number(e.target.value) || 1))}
              className={numCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.hcTimeout")}</FieldLabel>
            <input
              type="number"
              min={1}
              value={hcTimeout}
              onChange={(e) => setHcTimeout(Math.max(1, Number(e.target.value) || 1))}
              className={numCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.hcHealthy")}</FieldLabel>
            <input
              type="number"
              min={1}
              value={hcHealthy}
              onChange={(e) => setHcHealthy(Math.max(1, Number(e.target.value) || 1))}
              className={numCls}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.hcUnhealthy")}</FieldLabel>
            <input
              type="number"
              min={1}
              value={hcUnhealthy}
              onChange={(e) => setHcUnhealthy(Math.max(1, Number(e.target.value) || 1))}
              className={numCls}
            />
          </label>
          {isHttp && (
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("tg.hcMatcher")}</FieldLabel>
              <input
                value={hcMatcher}
                onChange={(e) => setHcMatcher(e.target.value)}
                className={cn(CONTROL_CLASS, "w-24 py-1.5 font-mono")}
              />
            </label>
          )}
          <Button
            variant="secondary"
            className="ml-auto"
            loading={saveHc.isPending}
            onClick={() => saveHc.mutate()}
          >
            {t("common.apply")}
          </Button>
        </div>
      </FormCard>

      <FormCard title={t("tg.attributes")}>
        <div className="flex flex-wrap items-end gap-4">
          <label className="flex items-center gap-2 self-center text-sm text-slate-700">
            <input
              type="checkbox"
              checked={stickiness}
              onChange={(e) => setStickiness(e.target.checked)}
            />
            {t("tg.stickiness")}
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.stickinessDuration")}</FieldLabel>
            <input
              type="number"
              value={duration}
              onChange={(e) => setDuration(Math.max(1, Number(e.target.value) || 1))}
              disabled={!stickiness}
              className={cn(CONTROL_CLASS, "w-28 py-1.5")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.deregDelay")}</FieldLabel>
            <input
              type="number"
              value={dereg}
              onChange={(e) => setDereg(Math.max(0, Number(e.target.value) || 0))}
              className={cn(CONTROL_CLASS, "w-28 py-1.5")}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("tg.algorithm")}</FieldLabel>
            <select
              value={algo}
              onChange={(e) => setAlgo(e.target.value)}
              className={cn(CONTROL_CLASS, "py-1.5")}
            >
              <option value="round_robin">round_robin</option>
              <option value="least_outstanding_requests">least_outstanding_requests</option>
            </select>
          </label>
          <Button
            variant="secondary"
            className="ml-auto"
            loading={save.isPending}
            onClick={() => save.mutate()}
          >
            {t("common.apply")}
          </Button>
        </div>
      </FormCard>

      <FormCard title={t("tags.heading")}>
        <TagsEditor
          current={tags.data ?? []}
          saving={saveTags.isPending}
          onSave={(tg2, removed) => saveTags.mutate({ tags: tg2, removed })}
        />
      </FormCard>
    </div>
  );
}

function HealthPanel({ tg, onClose }: { tg: TargetGroupSummary; onClose: () => void }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const health = useQuery({
    queryKey: ["target-health", tg.arn],
    queryFn: () => api.getTargetHealth(tg.arn),
  });
  const instances = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: ec2.listInstances,
    enabled: tg.targetType === "instance",
  });

  const [targetId, setTargetId] = useState("");
  const [port, setPort] = useState("");
  const refresh = () => qc.invalidateQueries({ queryKey: ["target-health", tg.arn] });

  const register = useMutation({
    mutationFn: () =>
      api.registerTarget(tg.arn, targetId.trim(), port.trim() ? Number(port) : null),
    onSuccess: () => {
      toast.success(t("tg.registered"));
      setTargetId("");
      setPort("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const deregister = useMutation({
    mutationFn: (h: TargetHealthEntry) => api.deregisterTarget(tg.arn, h.id, h.port),
    onSuccess: () => {
      toast.success(t("tg.deregistered"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_tg">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-semibold text-slate-900">{tg.name}</span>
        <span className="text-xs text-slate-500">{t("tg.targets")}</span>
      </PanelHeader>
      <div className="flex-1 overflow-auto p-4">
        <TgAttributes tg={tg} />

        {/* register a new target */}
        <FormCard title={t("tg.register")} className="mb-4">
          <div className="flex flex-wrap items-end gap-3">
            {/* biome-ignore lint/a11y/noLabelWithoutControl: the control (Select/input) is nested inside the label */}
            <label className="flex flex-1 flex-col gap-1.5">
              <FieldLabel>{t("tg.health.target")}</FieldLabel>
              {tg.targetType === "instance" ? (
                <Select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="w-full py-1.5"
                >
                  <option value="">{t("tg.pickInstance")}</option>
                  {(instances.data ?? []).map((i) => (
                    <option key={i.instanceId} value={i.instanceId}>
                      {i.name ? `${i.name} — ` : ""}
                      {i.instanceId}
                    </option>
                  ))}
                </Select>
              ) : (
                <input
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  placeholder={t("tg.targetIp")}
                  className={cn(CONTROL_CLASS, "w-full min-w-[10rem] py-1.5 font-mono")}
                />
              )}
            </label>
            <label className="flex flex-col gap-1.5">
              <FieldLabel>{t("tg.health.port")}</FieldLabel>
              <input
                value={port}
                onChange={(e) => setPort(e.target.value)}
                placeholder={tg.port != null ? String(tg.port) : t("tg.port")}
                className={cn(CONTROL_CLASS, "w-24 py-1.5")}
              />
            </label>
            <Button
              loading={register.isPending}
              disabled={!targetId.trim()}
              onClick={() => register.mutate()}
            >
              <Plus className="h-3.5 w-3.5" /> {t("tg.register")}
            </Button>
          </div>
        </FormCard>

        {health.isLoading ? (
          <TableLoading />
        ) : health.isError ? (
          <p className="text-sm text-red-600">{(health.error as Error).message}</p>
        ) : health.data && health.data.length > 0 ? (
          <Table>
            <Thead sticky={false}>
              <tr>
                <Th>{t("tg.health.target")}</Th>
                <Th>{t("tg.health.port")}</Th>
                <Th>{t("tg.health.state")}</Th>
                <Th>{t("tg.health.reason")}</Th>
                <Th />
              </tr>
            </Thead>
            <tbody>
              {health.data.map((h: TargetHealthEntry) => (
                <Tr key={`${h.id}:${h.port}`}>
                  <Td mono>{h.id}</Td>
                  <Td>{h.port ?? "—"}</Td>
                  <Td>
                    <StatusBadge tone={(h.state && HEALTH_TONES[h.state]) || "neutral"}>
                      {h.state ?? "—"}
                    </StatusBadge>
                  </Td>
                  <Td muted>
                    {h.reason ?? ""}
                    {h.description ? ` — ${h.description}` : ""}
                  </Td>
                  <Td className="text-right">
                    <button
                      type="button"
                      title={t("tg.deregister")}
                      onClick={() => deregister.mutate(h)}
                      className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <p className="text-sm text-slate-500">{t("tg.noTargets")}</p>
        )}
      </div>
    </ResizableBottomPanel>
  );
}

const TG_PROTOCOLS = ["HTTP", "HTTPS", "TCP", "TLS", "UDP"];

function CreateTgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [protocol, setProtocol] = useState("HTTP");
  const [port, setPort] = useState("80");
  const [targetType, setTargetType] = useState<"instance" | "ip">("instance");
  const [vpcId, setVpcId] = useState("");
  const [healthCheckPath, setHealthCheckPath] = useState("/");

  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const vpcIds = Array.from(
    new Set((subnets.data ?? []).map((s) => s.vpcId).filter(Boolean) as string[]),
  );

  const create = useMutation({
    mutationFn: () =>
      api.createTargetGroup({
        name: name.trim(),
        protocol,
        port: Number(port) || 80,
        targetType,
        vpcId: vpcId.trim() || undefined,
        healthCheckPath: protocol.startsWith("HTTP") ? healthCheckPath.trim() || "/" : undefined,
      }),
    onSuccess: () => {
      toast.success(t("tg.created", { name }));
      qc.invalidateQueries({ queryKey: ["target-groups"] });
      setName("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("tg.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("tg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tg.col.protocol")}>
            <Select value={protocol} onChange={(e) => setProtocol(e.target.value)}>
              {TG_PROTOCOLS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t("tg.port")}>
            <TextInput type="number" value={port} onChange={(e) => setPort(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("tg.col.targetType")}>
            <Select
              value={targetType}
              onChange={(e) => setTargetType(e.target.value as "instance" | "ip")}
            >
              <option value="instance">instance</option>
              <option value="ip">ip</option>
            </Select>
          </Field>
          <Field label={t("tg.col.vpc")}>
            <Select value={vpcId} onChange={(e) => setVpcId(e.target.value)}>
              <option value="">{t("sg.defaultVpc")}</option>
              {vpcIds.map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {protocol.startsWith("HTTP") && (
          <Field label={t("tg.healthCheckPath")}>
            <TextInput
              value={healthCheckPath}
              onChange={(e) => setHealthCheckPath(e.target.value)}
            />
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim()}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
