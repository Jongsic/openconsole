import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, ShieldCheck, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useParams } from "react-router-dom";
import {
  DetailHeader,
  PageHeader,
  ResourceTable,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResourceError } from "@/components/resource-error";
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
import { api } from "@/lib/ec2-api";
import { parsePortRange, splitCidrs } from "@/lib/inputs";
import type { Ec2SecurityGroup, Ec2SgRule, SgRuleInput } from "@/lib/types";
import { cn } from "@/lib/utils";

export function SecurityGroupsPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Ec2SecurityGroup | null>(null);

  const groups = useQuery({ queryKey: ["security-groups"], queryFn: api.listSecurityGroups });

  const del = useMutation({
    mutationFn: (groupId: string) => api.deleteSecurityGroup(groupId),
    onSuccess: () => {
      toast.success(t("sg.deleted"));
      qc.invalidateQueries({ queryKey: ["security-groups"] });
      setDeleteTarget(null);
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={ShieldCheck}
        title={t("sg.heading")}
        subtitle={t("sg.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["security-groups"] })}
        refreshing={groups.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> {t("sg.create")}
          </Button>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={groups.isLoading}
          isError={groups.isError}
          error={groups.error}
          service="EC2 security groups"
          data={groups.data}
          getKey={(g) => g.groupId}
          empty={{ icon: ShieldCheck, message: t("sg.none") }}
          head={
            <tr>
              <Th>{t("sg.col.name")}</Th>
              <Th>{t("sg.col.id")}</Th>
              <Th>{t("sg.col.vpc")}</Th>
              <Th>{t("sg.col.description")}</Th>
              <Th>{t("sg.col.rules")}</Th>
              <Th />
            </tr>
          }
          row={(g: Ec2SecurityGroup) => (
            <Tr key={g.groupId} onClick={() => navigate(g.groupId)}>
              <Td className="font-medium text-brand hover:underline">{g.groupName || "—"}</Td>
              <Td mono>{g.groupId}</Td>
              <Td mono>{g.vpcId ?? "—"}</Td>
              <Td muted>{g.description ?? "—"}</Td>
              <Td muted>{t("sg.ruleCount", { in: g.inbound.length, out: g.outbound.length })}</Td>
              <Td className="text-right">
                <button
                  type="button"
                  title={t("common.delete")}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(g);
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

      <CreateSgModal open={createOpen} onClose={() => setCreateOpen(false)} />

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title={t("sg.deleteTitle")}
      >
        <div className="flex flex-col gap-3 text-sm">
          <p>{t("sg.deleteConfirm", { name: deleteTarget?.groupName })}</p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="danger"
              loading={del.isPending}
              onClick={() => deleteTarget && del.mutate(deleteTarget.groupId)}
            >
              {t("common.delete")}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ── Detail page (route: /compute/security-groups/:groupId) ── */

export function SecurityGroupDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { groupId = "" } = useParams();
  const qc = useQueryClient();

  const groups = useQuery({ queryKey: ["security-groups"], queryFn: api.listSecurityGroups });
  const group = groups.data?.find((g) => g.groupId === groupId) ?? null;

  return (
    <div className="flex h-full flex-col">
      <DetailHeader
        title={group?.groupName || groupId}
        meta={`${groupId}${group?.vpcId ? ` · ${group.vpcId}` : ""}${
          group?.description ? ` · ${group.description}` : ""
        }`}
        onBack={() => navigate("/compute/security-groups")}
        backTitle={t("common.back")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["security-groups"] })}
        refreshing={groups.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto p-4">
        {groups.isLoading ? (
          <TableLoading />
        ) : groups.isError ? (
          <ResourceError error={groups.error} service="EC2 security groups" />
        ) : group ? (
          <div className="grid max-w-5xl gap-8 md:grid-cols-2">
            <RuleEditor group={group} direction="ingress" />
            <RuleEditor group={group} direction="egress" />
          </div>
        ) : (
          <p className="text-sm text-slate-500">{t("sg.notFound", { id: groupId })}</p>
        )}
      </div>
    </div>
  );
}

const PROTOCOLS = [
  { value: "tcp", label: "TCP" },
  { value: "udp", label: "UDP" },
  { value: "icmp", label: "ICMP" },
  { value: "-1", label: "All" },
];

function RuleEditor({
  group,
  direction,
}: {
  group: Ec2SecurityGroup;
  direction: "ingress" | "egress";
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const rules = direction === "ingress" ? group.inbound : group.outbound;

  const [protocol, setProtocol] = useState("tcp");
  const [port, setPort] = useState("");
  const [cidr, setCidr] = useState("0.0.0.0/0");

  const refresh = () => qc.invalidateQueries({ queryKey: ["security-groups"] });

  const add = useMutation({
    mutationFn: async () => {
      // Ports: "" → all (null); "80" → 80–80; "8000-8010" → range. Reject non-numeric.
      let fromPort: number | null = null;
      let toPort: number | null = null;
      if (protocol !== "-1") {
        let range: ReturnType<typeof parsePortRange>;
        try {
          range = parsePortRange(port);
        } catch {
          throw new Error(t("sg.invalidPort"));
        }
        if (range === null) throw new Error(t("sg.invalidPort"));
        fromPort = range.from;
        toPort = range.to;
      }
      // Source/destination: comma-separated CIDRs → one rule per CIDR.
      const cidrs = splitCidrs(cidr);
      if (cidrs.length === 0) throw new Error(t("sg.invalidSource"));
      for (const c of cidrs) {
        const input: SgRuleInput = { direction, protocol, fromPort, toPort, cidr: c };
        await api.authorizeRule(group.groupId, input);
      }
    },
    onSuccess: () => {
      toast.success(t("sg.ruleAdded"));
      setPort("");
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const remove = useMutation({
    mutationFn: (r: Ec2SgRule) =>
      api.revokeRule(group.groupId, {
        direction,
        protocol: r.protocol,
        fromPort: r.fromPort,
        toPort: r.toPort,
        cidr: r.source,
      }),
    onSuccess: () => {
      toast.success(t("sg.ruleRemoved"));
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const portsLabel = (r: Ec2SgRule) => {
    if (r.fromPort == null && r.toPort == null) return t("ec2.security.allPorts");
    if (r.fromPort === r.toPort) return String(r.fromPort);
    return `${r.fromPort}–${r.toPort}`;
  };

  return (
    <div>
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {direction === "ingress" ? t("ec2.security.inbound") : t("ec2.security.outbound")}
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2 font-semibold">{t("ec2.security.protocol")}</th>
              <th className="px-3 py-2 font-semibold">{t("ec2.security.ports")}</th>
              <th className="px-3 py-2 font-semibold">{t("ec2.security.source")}</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rules.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules have no stable id
              <tr key={i} className="hover:bg-slate-50">
                <td className="px-3 py-2 text-slate-700">
                  {r.protocol === "-1" ? t("ec2.security.allTraffic") : r.protocol}
                </td>
                <td className="px-3 py-2 text-slate-700">{portsLabel(r)}</td>
                <td className="px-3 py-2 font-mono text-slate-600">{r.source}</td>
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    title={t("common.delete")}
                    onClick={() => remove.mutate(r)}
                    className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-600"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-500">
                  {t("ec2.security.noRules")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          {/* biome-ignore lint/a11y/noLabelWithoutControl: the <Select> control is nested inside the label */}
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("ec2.security.protocol")}</FieldLabel>
            <Select
              value={protocol}
              onChange={(e) => setProtocol(e.target.value)}
              className="w-24 py-1.5"
            >
              {PROTOCOLS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </label>
          <label className="flex flex-col gap-1.5">
            <FieldLabel>{t("ec2.security.ports")}</FieldLabel>
            <input
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="80 / 8000-8010"
              disabled={protocol === "-1"}
              className={cn(CONTROL_CLASS, "w-28 py-1.5")}
            />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <FieldLabel>{t("ec2.security.source")}</FieldLabel>
            <input
              value={cidr}
              onChange={(e) => setCidr(e.target.value)}
              placeholder="0.0.0.0/0, 10.0.0.0/8"
              className={cn(CONTROL_CLASS, "w-full min-w-[12rem] py-1.5 font-mono")}
            />
          </label>
          <Button
            loading={add.isPending}
            disabled={!cidr.trim() || (protocol !== "-1" && port.trim() === "")}
            onClick={() => add.mutate()}
          >
            <Plus className="h-3.5 w-3.5" /> {t("sg.addRule")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CreateSgModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [vpcId, setVpcId] = useState("");

  const subnetsForVpc = useQuery({
    queryKey: ["subnets"],
    queryFn: api.listSubnets,
    enabled: open,
  });
  const vpcIds = Array.from(
    new Set((subnetsForVpc.data ?? []).map((s) => s.vpcId).filter(Boolean) as string[]),
  );

  const create = useMutation({
    mutationFn: () =>
      api.createSecurityGroup({
        groupName: name.trim(),
        description: description.trim(),
        vpcId: vpcId.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success(t("sg.created", { name }));
      qc.invalidateQueries({ queryKey: ["security-groups"] });
      setName("");
      setDescription("");
      setVpcId("");
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <Modal open={open} onClose={onClose} title={t("sg.createTitle")}>
      <div className="flex flex-col gap-3">
        <Field label={t("sg.col.name")}>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" />
        </Field>
        <Field label={t("sg.col.description")}>
          <TextInput value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label={t("sg.vpc")}>
          <Select value={vpcId} onChange={(e) => setVpcId(e.target.value)}>
            <option value="">{t("sg.defaultVpc")}</option>
            {vpcIds.map((v) => (
              <option key={v} value={v}>
                {v}
              </option>
            ))}
          </Select>
        </Field>
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
