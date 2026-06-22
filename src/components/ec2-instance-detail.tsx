import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { api } from "@/lib/ec2-api";
import type {
  Ec2InstanceDetail,
  Ec2NetworkInterface,
  Ec2SecurityGroup,
  Ec2Volume,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { StateBadge, TRANSITIONAL_STATES } from "@/pages/ec2";
import { DefinitionGrid, KV, PanelHeader, Table, TableLoading, Td, Th, Thead, Tr } from "./kit";
import { ResizableBottomPanel } from "./resizable-bottom-panel";
import { SecurityGroupCard } from "./sg-rules";
import { TagsEditor } from "./tags-editor";
import { useToast } from "./toast";
import { Button, FieldLabel, Select, Spinner } from "./ui";

const INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "t4g.micro",
  "t4g.small",
  "t4g.medium",
  "m5.large",
  "c5.large",
];

/** Mutation that refreshes the instance detail + list after an edit. */
function useDetailEdit(instanceId: string, successMsg: string) {
  const toast = useToast();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: ["ec2-detail", instanceId] });
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
      qc.invalidateQueries({ queryKey: ["ec2-sg", instanceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });
}

type Tab = "details" | "security" | "networking" | "storage" | "tags";
const TABS: Tab[] = ["details", "security", "networking", "storage", "tags"];

export function Ec2DetailPanel({
  instanceId,
  onClose,
}: {
  instanceId: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("details");

  const detail = useQuery({
    queryKey: ["ec2-detail", instanceId],
    queryFn: () => api.getInstanceDetail(instanceId),
    // Keep the header state badge live while the instance is mid-transition.
    refetchInterval: (q) =>
      q.state.data && TRANSITIONAL_STATES.has(q.state.data.state) ? 3000 : false,
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["ec2-detail", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-sg", instanceId] });
    qc.invalidateQueries({ queryKey: ["ec2-volumes", instanceId] });
  };

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_ec2">
      <PanelHeader
        onRefresh={refresh}
        refreshing={detail.isFetching}
        refreshTitle={t("common.refresh")}
        onClose={onClose}
        closeTitle={t("common.close")}
      >
        <span className="font-mono text-xs text-slate-500">{instanceId}</span>
        {detail.data?.name && (
          <span className="text-sm font-semibold text-slate-900">{detail.data.name}</span>
        )}
        {detail.data && <StateBadge state={detail.data.state} />}
      </PanelHeader>

      <nav className="flex gap-1 border-b border-slate-200 px-3">
        {TABS.map((tb) => (
          <button
            key={tb}
            type="button"
            onClick={() => setTab(tb)}
            className={cn(
              "relative px-3 py-2 text-sm font-medium",
              tab === tb ? "text-brand" : "text-slate-600 hover:text-slate-900",
            )}
          >
            {t(`ec2.tabs.${tb}`)}
            {tab === tb && (
              <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
            )}
          </button>
        ))}
      </nav>

      <div className="flex-1 overflow-auto p-4">
        {detail.isLoading ? (
          <TableLoading />
        ) : detail.isError ? (
          <p className="text-sm text-red-600">{(detail.error as Error).message}</p>
        ) : detail.data ? (
          <TabBody tab={tab} instanceId={instanceId} detail={detail.data} active={tab} />
        ) : null}
      </div>
    </ResizableBottomPanel>
  );
}

function TabBody({
  tab,
  instanceId,
  detail,
  active,
}: {
  tab: Tab;
  instanceId: string;
  detail: Ec2InstanceDetail;
  active: Tab;
}) {
  switch (tab) {
    case "details":
      return <DetailsTab instanceId={instanceId} detail={detail} />;
    case "networking":
      return <NetworkingTab detail={detail} />;
    case "tags":
      return <TagsTab instanceId={instanceId} detail={detail} />;
    case "security":
      return <SecurityTab detail={detail} enabled={active === "security"} />;
    case "storage":
      return <StorageTab instanceId={instanceId} enabled={active === "storage"} />;
  }
}

function DetailsTab({ instanceId, detail }: { instanceId: string; detail: Ec2InstanceDetail }) {
  const { t, i18n } = useTranslation();
  const edit = useDetailEdit(instanceId, t("ec2.edit.typeChanged"));
  const stopped = detail.state === "stopped";
  const [type, setType] = useState(detail.instanceType ?? "");
  useEffect(() => setType(detail.instanceType ?? ""), [detail.instanceType]);

  const typeOptions = Array.from(
    new Set([detail.instanceType, ...INSTANCE_TYPES].filter(Boolean) as string[]),
  );

  const imdsv2 = detail.metadataHttpTokens
    ? `${detail.metadataHttpTokens}${
        detail.metadataHopLimit != null ? ` (hop ${detail.metadataHopLimit})` : ""
      }`
    : null;

  return (
    <div className="flex flex-col gap-5">
      <DefinitionGrid>
        <KV label={t("ec2.detail.instanceType")}>
          {stopped ? (
            <div className="flex items-center gap-2">
              <Select value={type} onChange={(e) => setType(e.target.value)} className="px-2 py-1">
                {typeOptions.map((it) => (
                  <option key={it} value={it}>
                    {it}
                  </option>
                ))}
              </Select>
              <Button
                variant="secondary"
                loading={edit.isPending}
                disabled={type === detail.instanceType}
                onClick={() => edit.mutate(() => api.modifyInstanceType(instanceId, type))}
              >
                {t("common.apply")}
              </Button>
            </div>
          ) : (
            <div className="text-sm text-slate-700">
              {detail.instanceType || "—"}
              <span className="ml-2 text-xs text-slate-500">{t("ec2.edit.typeStoppedHint")}</span>
            </div>
          )}
        </KV>
        <KV label={t("ec2.detail.ami")} value={detail.imageId} mono />
        <KV label={t("ec2.detail.keyName")} value={detail.keyName} />
        <KV
          label={t("ec2.detail.launchTime")}
          value={formatDate(detail.launchTime, i18n.language)}
        />
        <KV label={t("ec2.detail.az")} value={detail.availabilityZone} />
        <KV label={t("ec2.detail.monitoring")} value={detail.monitoring} />
        <KV label={t("ec2.detail.architecture")} value={detail.architecture} />
        <KV label={t("ec2.detail.platform")} value={detail.platform} />
        <KV label={t("ec2.detail.rootDevice")} value={detail.rootDeviceName} mono />
        <KV label={t("ec2.detail.iamRole")} value={detail.iamInstanceProfileArn} mono />
        <KV label={t("ec2.detail.imdsv2")} value={imdsv2} />
      </DefinitionGrid>
      <InstanceProtection instanceId={instanceId} />
      <UserDataView instanceId={instanceId} />
    </div>
  );
}

/** Termination + stop protection toggles. */
function InstanceProtection({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const prot = useQuery({
    queryKey: ["ec2-protection", instanceId],
    queryFn: () => api.getInstanceProtection(instanceId),
  });

  const mutate = useMutation({
    mutationFn: (fn: () => Promise<void>) => fn(),
    onSuccess: () => {
      toast.success(t("ec2.edit.protectionChanged"));
      qc.invalidateQueries({ queryKey: ["ec2-protection", instanceId] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate-500">{t("ec2.detail.protection")}</div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={prot.isLoading || mutate.isPending}
            checked={prot.data?.terminationProtection ?? false}
            onChange={(e) =>
              mutate.mutate(() => api.setTerminationProtection(instanceId, e.target.checked))
            }
          />
          {t("ec2.detail.terminationProtection")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            disabled={prot.isLoading || mutate.isPending}
            checked={prot.data?.stopProtection ?? false}
            onChange={(e) =>
              mutate.mutate(() => api.setStopProtection(instanceId, e.target.checked))
            }
          />
          {t("ec2.detail.stopProtection")}
        </label>
      </div>
    </div>
  );
}

/** Lazily fetch + show the instance's user data (decoded). */
function UserDataView({ instanceId }: { instanceId: string }) {
  const { t } = useTranslation();
  const ud = useQuery({
    queryKey: ["ec2-userdata", instanceId],
    queryFn: () => api.getUserData(instanceId),
  });
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium text-slate-500">{t("ec2.detail.userData")}</div>
      {ud.isLoading ? (
        <Spinner className="h-4 w-4" />
      ) : ud.data ? (
        <pre className="max-h-32 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-700">
          {ud.data}
        </pre>
      ) : (
        <span className="text-sm text-slate-500">{t("ec2.detail.noUserData")}</span>
      )}
    </div>
  );
}

function NetworkingTab({ detail }: { detail: Ec2InstanceDetail }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-5">
      <DefinitionGrid>
        <KV label={t("ec2.detail.vpc")} value={detail.vpcId} mono />
        <KV label={t("ec2.detail.subnet")} value={detail.subnetId} mono />
        <KV label={t("ec2.detail.publicIp")} value={detail.publicIp} mono />
        <KV label={t("ec2.detail.publicDns")} value={detail.publicDns} mono />
        <KV label={t("ec2.detail.privateIp")} value={detail.privateIp} mono />
        <KV label={t("ec2.detail.privateDns")} value={detail.privateDns} mono />
      </DefinitionGrid>

      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          {t("ec2.networking.interfaces")}
        </div>
        {detail.networkInterfaces.length === 0 ? (
          <p className="text-sm text-slate-500">{t("ec2.networking.none")}</p>
        ) : (
          <Table>
            <Thead sticky={false}>
              <tr>
                <Th>{t("ec2.networking.eni")}</Th>
                <Th>{t("ec2.networking.status")}</Th>
                <Th>{t("ec2.detail.privateIp")}</Th>
                <Th>{t("ec2.networking.mac")}</Th>
              </tr>
            </Thead>
            <tbody>
              {detail.networkInterfaces.map((ni: Ec2NetworkInterface) => (
                <Tr key={ni.networkInterfaceId}>
                  <Td mono>{ni.networkInterfaceId}</Td>
                  <Td>{ni.status ?? "—"}</Td>
                  <Td mono>{ni.privateIp ?? "—"}</Td>
                  <Td mono>{ni.macAddress ?? "—"}</Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </div>
    </div>
  );
}

function TagsTab({ instanceId, detail }: { instanceId: string; detail: Ec2InstanceDetail }) {
  const { t } = useTranslation();
  const edit = useDetailEdit(instanceId, t("ec2.edit.tagsSaved"));
  return (
    <TagsEditor
      current={detail.tags}
      saving={edit.isPending}
      onSave={(tags, removed) => edit.mutate(() => api.saveTags(instanceId, tags, removed))}
    />
  );
}

function SecurityTab({ detail, enabled }: { detail: Ec2InstanceDetail; enabled: boolean }) {
  const { t } = useTranslation();
  const groupIds = detail.securityGroups.map((g) => g.groupId);
  const sgs = useQuery({
    queryKey: ["ec2-sg", detail.instanceId, groupIds],
    queryFn: () => api.getSecurityGroups(groupIds),
    enabled: enabled && groupIds.length > 0,
  });

  return (
    <div className="flex flex-col gap-5">
      <SgEditor instanceId={detail.instanceId} current={groupIds} />

      {/* All attached groups as links into the Security groups page */}
      {detail.securityGroups.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("ec2.security.attached")}
          </span>
          {detail.securityGroups.map((g) => (
            <Link
              key={g.groupId}
              to={`/compute/security-groups/${g.groupId}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1 text-xs transition-colors hover:border-brand hover:bg-brand-fg"
            >
              <span className="font-medium text-slate-800">{g.groupName || g.groupId}</span>
              <span className="font-mono text-slate-500">{g.groupId}</span>
            </Link>
          ))}
        </div>
      )}

      {groupIds.length === 0 ? (
        <p className="text-sm text-slate-500">{t("ec2.security.none")}</p>
      ) : sgs.isLoading ? (
        <TableLoading />
      ) : sgs.isError ? (
        <p className="text-sm text-red-600">{(sgs.error as Error).message}</p>
      ) : (
        (sgs.data ?? []).map((g: Ec2SecurityGroup) => (
          <SecurityGroupCard key={g.groupId} group={g} />
        ))
      )}
    </div>
  );
}

/** Change which security groups are attached to the instance. */
function SgEditor({ instanceId, current }: { instanceId: string; current: string[] }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const edit = useDetailEdit(instanceId, t("ec2.edit.sgChanged"));
  const all = useQuery({
    queryKey: ["security-groups"],
    queryFn: api.listSecurityGroups,
    enabled: open,
  });
  const [selected, setSelected] = useState<string[]>(current);
  useEffect(() => setSelected(current), [current]);

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  if (!open) {
    return (
      <Button variant="secondary" className="self-start" onClick={() => setOpen(true)}>
        {t("ec2.edit.changeSg")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <FieldLabel>{t("ec2.edit.changeSg")}</FieldLabel>
      <div className="max-h-32 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
        {(all.data ?? []).map((g) => (
          <label
            key={g.groupId}
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
              selected.includes(g.groupId) && "bg-brand-fg hover:bg-brand-tint",
            )}
          >
            <input
              type="checkbox"
              checked={selected.includes(g.groupId)}
              onChange={() => toggle(g.groupId)}
            />
            <span className="font-medium text-slate-800">{g.groupName}</span>
            <span className="font-mono text-slate-500">{g.groupId}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          {t("common.cancel")}
        </Button>
        <Button
          loading={edit.isPending}
          disabled={selected.length === 0}
          onClick={() =>
            edit.mutate(async () => {
              await api.modifyInstanceSecurityGroups(instanceId, selected);
              setOpen(false);
            })
          }
        >
          {t("common.apply")}
        </Button>
      </div>
    </div>
  );
}

function StorageTab({ instanceId, enabled }: { instanceId: string; enabled: boolean }) {
  const { t } = useTranslation();
  const volumes = useQuery({
    queryKey: ["ec2-volumes", instanceId],
    queryFn: () => api.getVolumes(instanceId),
    enabled,
  });

  if (volumes.isLoading) return <TableLoading />;
  if (volumes.isError)
    return <p className="text-sm text-red-600">{(volumes.error as Error).message}</p>;
  if (!volumes.data || volumes.data.length === 0)
    return <p className="text-sm text-slate-500">{t("ec2.storage.none")}</p>;

  return (
    <Table>
      <Thead sticky={false}>
        <tr>
          <Th>{t("ec2.storage.volumeId")}</Th>
          <Th>{t("ec2.storage.device")}</Th>
          <Th>{t("ec2.storage.size")}</Th>
          <Th>{t("ec2.storage.type")}</Th>
          <Th>{t("ec2.storage.iops")}</Th>
          <Th>{t("ec2.storage.encrypted")}</Th>
          <Th>{t("ec2.storage.state")}</Th>
        </tr>
      </Thead>
      <tbody>
        {volumes.data.map((v: Ec2Volume) => (
          <Tr key={v.volumeId}>
            <Td mono>{v.volumeId}</Td>
            <Td mono>{v.deviceName ?? "—"}</Td>
            <Td>{v.size} GiB</Td>
            <Td>{v.volumeType ?? "—"}</Td>
            <Td>{v.iops ?? "—"}</Td>
            <Td>{v.encrypted ? "✓" : "—"}</Td>
            <Td>{v.state ?? "—"}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
