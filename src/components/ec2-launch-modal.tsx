import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { api } from "@/lib/ec2-api";
import type { Ec2LaunchInput } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useToast } from "./toast";
import { Button, Field, Modal, Select, TextInput } from "./ui";

const INSTANCE_TYPES = [
  "t2.micro",
  "t2.small",
  "t3.micro",
  "t3.small",
  "t3.medium",
  "m5.large",
  "c5.large",
];

export function Ec2LaunchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [imageId, setImageId] = useState("ami-0abcdef1234567890");
  const [instanceType, setInstanceType] = useState("t3.micro");
  const [count, setCount] = useState(1);
  const [advanced, setAdvanced] = useState(false);
  const [keyName, setKeyName] = useState("");
  const [securityGroupIds, setSecurityGroupIds] = useState<string[]>([]);
  const [subnetId, setSubnetId] = useState("");

  // Live pickers — loaded only while the dialog is open.
  const keyPairs = useQuery({ queryKey: ["key-pairs"], queryFn: api.listKeyPairs, enabled: open });
  const sgs = useQuery({
    queryKey: ["security-groups"],
    queryFn: api.listSecurityGroups,
    enabled: open,
  });
  const subnets = useQuery({ queryKey: ["subnets"], queryFn: api.listSubnets, enabled: open });

  const toggleSg = (id: string) =>
    setSecurityGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const launch = useMutation({
    mutationFn: () => {
      const input: Ec2LaunchInput = {
        imageId: imageId.trim(),
        instanceType: instanceType.trim(),
        count,
        name: name.trim() || undefined,
        keyName: keyName.trim() || undefined,
        securityGroupIds,
        subnetId: subnetId.trim() || undefined,
      };
      return api.launchInstances(input);
    },
    onSuccess: () => {
      toast.success(t("ec2.launch.created"));
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
      onClose();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const valid = imageId.trim() !== "" && instanceType.trim() !== "" && count >= 1;

  return (
    <Modal open={open} onClose={onClose} title={t("ec2.launch.title")} className="max-w-md">
      <div className="flex flex-col gap-3">
        <Field label={t("ec2.launch.name")}>
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-instance"
          />
        </Field>

        <Field label={t("ec2.launch.ami")}>
          <TextInput value={imageId} onChange={(e) => setImageId(e.target.value)} />
          <span className="text-xs text-slate-500">{t("ec2.launch.amiHint")}</span>
        </Field>

        <Field label={t("ec2.launch.instanceType")}>
          <Select value={instanceType} onChange={(e) => setInstanceType(e.target.value)}>
            {INSTANCE_TYPES.map((it) => (
              <option key={it} value={it}>
                {it}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("ec2.launch.count")}>
          <TextInput
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Math.max(1, Number(e.target.value) || 1))}
            className="w-28"
          />
        </Field>

        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="self-start text-xs font-medium text-brand hover:underline"
        >
          {advanced ? "− " : "+ "}
          {t("ec2.launch.advanced")}
        </button>

        {advanced && (
          <div className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <Field label={t("ec2.launch.keyName")}>
              <Select value={keyName} onChange={(e) => setKeyName(e.target.value)}>
                <option value="">{t("ec2.launch.none")}</option>
                {(keyPairs.data ?? []).map((k) => (
                  <option key={k.keyName} value={k.keyName}>
                    {k.keyName}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t("ec2.launch.securityGroups")}>
              <div className="max-h-32 overflow-auto rounded-md border border-slate-300 bg-white p-1.5">
                {(sgs.data ?? []).length === 0 ? (
                  <p className="px-1 py-1 text-xs text-slate-500">
                    {t("ec2.launch.noSecurityGroups")}
                  </p>
                ) : (
                  (sgs.data ?? []).map((g) => (
                    <label
                      key={g.groupId}
                      className={cn(
                        "flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-xs transition-colors hover:bg-slate-50",
                        securityGroupIds.includes(g.groupId) && "bg-brand-fg hover:bg-brand-tint",
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={securityGroupIds.includes(g.groupId)}
                        onChange={() => toggleSg(g.groupId)}
                      />
                      <span className="font-medium text-slate-800">{g.groupName}</span>
                      <span className="font-mono text-slate-500">{g.groupId}</span>
                    </label>
                  ))
                )}
              </div>
              <span className="text-xs text-slate-500">{t("ec2.launch.securityGroupsHint")}</span>
            </Field>

            <Field label={t("ec2.launch.subnet")}>
              <Select value={subnetId} onChange={(e) => setSubnetId(e.target.value)}>
                <option value="">{t("ec2.launch.defaultSubnet")}</option>
                {(subnets.data ?? []).map((s) => (
                  <option key={s.subnetId} value={s.subnetId}>
                    {s.subnetId}
                    {s.name ? ` (${s.name})` : ""}
                    {s.availabilityZone ? ` — ${s.availabilityZone}` : ""}
                    {s.cidrBlock ? ` ${s.cidrBlock}` : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => launch.mutate()} loading={launch.isPending} disabled={!valid}>
            {t("ec2.launch.submit")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
