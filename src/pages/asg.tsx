import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, TrendingUp } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  PageHeader,
  PanelHeader,
  ResourceTable,
  SectionTitle,
  Table,
  TableLoading,
  Td,
  Th,
  Thead,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { useToast } from "@/components/toast";
import {
  Button,
  CONTROL_CLASS,
  Field,
  FieldLabel,
  Modal,
  Select,
  TextInput,
} from "@/components/ui";
import { api } from "@/lib/autoscaling-api";
import { api as ec2 } from "@/lib/ec2-api";
import { api as elbv2 } from "@/lib/elbv2-api";
import type { AsgSummary } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export function AsgPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const [selected, setSelected] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const asgs = useQuery({ queryKey: ["asgs"], queryFn: api.listAutoScalingGroups });
  const current = asgs.data?.find((g) => g.name === selected) ?? null;

  const del = useMutation({
    mutationFn: (name: string) => api.deleteAutoScalingGroup(name, true),
    onSuccess: (_d, name) => {
      toast.success(t("asg.deleted"));
      qc.invalidateQueries({ queryKey: ["asgs"] });
      if (selected === name) setSelected(null);
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={TrendingUp}
        title={t("asg.heading")}
        subtitle={t("asg.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["asgs"] })}
        refreshing={asgs.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("asg.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={asgs.isLoading}
          isError={asgs.isError}
          error={asgs.error}
          service="Auto Scaling"
          data={asgs.data}
          getKey={(g) => g.name}
          empty={{ icon: TrendingUp, message: t("asg.none") }}
          head={
            <tr>
              <Th>{t("asg.col.name")}</Th>
              <Th>{t("asg.col.capacity")}</Th>
              <Th>{t("asg.col.instances")}</Th>
              <Th>{t("asg.col.healthCheck")}</Th>
              <Th>{t("asg.col.launchTemplate")}</Th>
              <Th>{t("asg.col.azs")}</Th>
              <Th />
            </tr>
          }
          row={(g: AsgSummary) => (
            <Tr key={g.name} onClick={() => setSelected(g.name)} selected={selected === g.name}>
              <Td className="font-medium text-slate-700">{g.name}</Td>
              <Td>
                {t("asg.capacityFmt", {
                  min: g.minSize,
                  desired: g.desiredCapacity,
                  max: g.maxSize,
                })}
              </Td>
              <Td>{g.instanceCount}</Td>
              <Td>{g.healthCheckType ?? "—"}</Td>
              <Td>{g.launchTemplate ?? "—"}</Td>
              <Td muted>{g.availabilityZones.join(", ") || "—"}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(g.name);
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

      {current && (
        <AsgDetailPanel key={current.name} name={current.name} onClose={() => setSelected(null)} />
      )}

      <CreateAsgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("asg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("asg.deleteConfirm", { name: deleteTarget })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function CreateAsgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [launchTemplateId, setLaunchTemplateId] = useState("");
  const [minSize, setMinSize] = useState(1);
  const [maxSize, setMaxSize] = useState(2);
  const [desired, setDesired] = useState(1);
  const [subnetIds, setSubnetIds] = useState<string[]>([]);
  const [targetGroupArns, setTargetGroupArns] = useState<string[]>([]);

  const templates = useQuery({
    queryKey: ["launch-templates"],
    queryFn: ec2.listLaunchTemplates,
    enabled: open,
  });
  const subnets = useQuery({ queryKey: ["subnets"], queryFn: ec2.listSubnets, enabled: open });
  const tgs = useQuery({
    queryKey: ["target-groups"],
    queryFn: elbv2.listTargetGroups,
    enabled: open,
  });

  const toggle = (set: React.Dispatch<React.SetStateAction<string[]>>, id: string) =>
    set((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const create = useMutation({
    mutationFn: () =>
      api.createAutoScalingGroup({
        name: name.trim(),
        launchTemplateId,
        minSize,
        maxSize,
        desiredCapacity: desired,
        subnetIds,
        targetGroupArns,
      }),
    onSuccess: () => {
      toast.success(t("asg.created", { name }));
      qc.invalidateQueries({ queryKey: ["asgs"] });
      setName("");
      setSubnetIds([]);
      setTargetGroupArns([]);
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("asg.createTitle")} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t("asg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("asg.col.launchTemplate")}>
          <Select value={launchTemplateId} onChange={(e) => setLaunchTemplateId(e.target.value)}>
            <option value="">{t("asg.pickTemplate")}</option>
            {(templates.data ?? []).map((lt) => (
              <option key={lt.launchTemplateId} value={lt.launchTemplateId}>
                {lt.launchTemplateName} ({lt.launchTemplateId})
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label={t("asg.min")}>
            <TextInput
              type="number"
              min={0}
              value={minSize}
              onChange={(e) => setMinSize(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label={t("asg.desired")}>
            <TextInput
              type="number"
              min={0}
              value={desired}
              onChange={(e) => setDesired(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
          <Field label={t("asg.max")}>
            <TextInput
              type="number"
              min={0}
              value={maxSize}
              onChange={(e) => setMaxSize(Math.max(0, Number(e.target.value) || 0))}
            />
          </Field>
        </div>
        <Field label={t("alb.subnets")}>
          <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
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
        </Field>
        {(tgs.data ?? []).length > 0 && (
          <Field label={t("compute.targetGroups")}>
            <div className="max-h-24 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
              {(tgs.data ?? []).map((tg) => (
                <label
                  key={tg.arn}
                  className={cn(
                    "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
                    targetGroupArns.includes(tg.arn) && "bg-brand-fg hover:bg-brand-tint",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={targetGroupArns.includes(tg.arn)}
                    onChange={() => toggle(setTargetGroupArns, tg.arn)}
                  />
                  <span className="font-medium text-slate-800">{tg.name}</span>
                </label>
              ))}
            </div>
          </Field>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button
            loading={create.isPending}
            disabled={!name.trim() || !launchTemplateId || subnetIds.length === 0}
            onClick={() => create.mutate()}
          >
            {t("common.create")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

function CapacityEditor({
  name,
  min,
  desired,
  max,
}: {
  name: string;
  min: number;
  desired: number;
  max: number;
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [minSize, setMinSize] = useState(min);
  const [desiredCapacity, setDesired] = useState(desired);
  const [maxSize, setMaxSize] = useState(max);

  const save = useMutation({
    mutationFn: () => api.updateCapacity(name, { minSize, maxSize, desiredCapacity }),
    onSuccess: () => {
      toast.success(t("asg.capacityUpdated"));
      qc.invalidateQueries({ queryKey: ["asg-detail", name] });
      qc.invalidateQueries({ queryKey: ["asgs"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const inputCls = cn(CONTROL_CLASS, "w-20 py-1.5");

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <SectionTitle>{t("asg.section.capacity")}</SectionTitle>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("asg.min")}</FieldLabel>
          <input
            type="number"
            min={0}
            value={minSize}
            onChange={(e) => setMinSize(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("asg.desired")}</FieldLabel>
          <input
            type="number"
            min={0}
            value={desiredCapacity}
            onChange={(e) => setDesired(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <FieldLabel>{t("asg.max")}</FieldLabel>
          <input
            type="number"
            min={0}
            value={maxSize}
            onChange={(e) => setMaxSize(Math.max(0, Number(e.target.value) || 0))}
            className={inputCls}
          />
        </label>
        <Button variant="secondary" loading={save.isPending} onClick={() => save.mutate()}>
          {t("common.apply")}
        </Button>
      </div>
    </div>
  );
}

function AsgDetailPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const { t, i18n } = useTranslation();
  const detail = useQuery({
    queryKey: ["asg-detail", name],
    queryFn: () => api.getAutoScalingGroupDetail(name),
  });

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_asg">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-semibold text-slate-900">{name}</span>
      </PanelHeader>
      <div className="flex-1 overflow-auto p-4">
        {detail.isLoading ? (
          <TableLoading />
        ) : detail.isError ? (
          <p className="text-sm text-red-600">{(detail.error as Error).message}</p>
        ) : detail.data ? (
          <div className="flex flex-col gap-6">
            <CapacityEditor
              name={name}
              min={detail.data.minSize}
              desired={detail.data.desiredCapacity}
              max={detail.data.maxSize}
            />
            <div>
              <SectionTitle>{t("asg.section.instances")}</SectionTitle>
              {detail.data.instances.length === 0 ? (
                <p className="text-sm text-slate-500">{t("asg.noInstances")}</p>
              ) : (
                <Table>
                  <Thead sticky={false}>
                    <tr>
                      <Th>{t("asg.inst.id")}</Th>
                      <Th>{t("asg.inst.lifecycle")}</Th>
                      <Th>{t("asg.inst.health")}</Th>
                      <Th>{t("asg.inst.az")}</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {detail.data.instances.map((i) => (
                      <Tr key={i.instanceId}>
                        <Td mono>{i.instanceId}</Td>
                        <Td>{i.lifecycleState ?? "—"}</Td>
                        <Td>{i.healthStatus ?? "—"}</Td>
                        <Td>{i.availabilityZone ?? "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            <div>
              <SectionTitle>{t("asg.section.policies")}</SectionTitle>
              {detail.data.policies.length === 0 ? (
                <p className="text-sm text-slate-500">{t("asg.noPolicies")}</p>
              ) : (
                <Table>
                  <Thead sticky={false}>
                    <tr>
                      <Th>{t("asg.pol.name")}</Th>
                      <Th>{t("asg.pol.type")}</Th>
                      <Th>{t("asg.pol.metric")}</Th>
                      <Th>{t("asg.pol.target")}</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {detail.data.policies.map((p) => (
                      <Tr key={p.name}>
                        <Td>{p.name}</Td>
                        <Td>{p.type ?? "—"}</Td>
                        <Td>{p.metric ?? "—"}</Td>
                        <Td>{p.targetValue ?? "—"}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>

            <div>
              <SectionTitle>{t("asg.section.scheduled")}</SectionTitle>
              {detail.data.scheduledActions.length === 0 ? (
                <p className="text-sm text-slate-500">{t("asg.noScheduled")}</p>
              ) : (
                <Table>
                  <Thead sticky={false}>
                    <tr>
                      <Th>{t("asg.sched.name")}</Th>
                      <Th>{t("asg.sched.recurrence")}</Th>
                      <Th>{t("asg.sched.capacity")}</Th>
                      <Th>{t("asg.sched.start")}</Th>
                    </tr>
                  </Thead>
                  <tbody>
                    {detail.data.scheduledActions.map((s) => (
                      <Tr key={s.name}>
                        <Td>{s.name}</Td>
                        <Td mono>{s.recurrence ?? "—"}</Td>
                        <Td>
                          {[s.minSize, s.desiredCapacity, s.maxSize]
                            .map((n) => (n == null ? "—" : n))
                            .join(" / ")}
                        </Td>
                        <Td muted>{formatDate(s.startTime, i18n.language)}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </ResizableBottomPanel>
  );
}
