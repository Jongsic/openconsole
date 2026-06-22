import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Plus, RotateCw, Server, Square, Terminal, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Ec2DetailPanel } from "@/components/ec2-instance-detail";
import { Ec2LaunchModal } from "@/components/ec2-launch-modal";
import {
  PageHeader,
  ResourceTable,
  StatusBadge,
  type StatusTone,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { useToast } from "@/components/toast";
import { Button, Modal } from "@/components/ui";
import { api } from "@/lib/ec2-api";
import type { Ec2InstanceAction, Ec2InstanceState, Ec2InstanceSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";
import { useSettings } from "@/store/settings";

/** States that are mid-transition and will change on their own → worth polling for. */
export const TRANSITIONAL_STATES = new Set<Ec2InstanceState>([
  "pending",
  "stopping",
  "shutting-down",
]);

const STATE_TONES: Record<Ec2InstanceState, StatusTone> = {
  running: "green",
  stopped: "neutral",
  pending: "amber",
  stopping: "amber",
  "shutting-down": "amber",
  terminated: "red",
};

export function StateBadge({ state }: { state: Ec2InstanceState }) {
  return <StatusBadge tone={STATE_TONES[state] ?? "neutral"}>{state}</StatusBadge>;
}

export function Ec2Page() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const toast = useToast();
  const backend = useSettings((s) => s.backend);
  const [selected, setSelected] = useState<string | null>(null);
  const [terminateTarget, setTerminateTarget] = useState<string | null>(null);
  const [launchOpen, setLaunchOpen] = useState(false);

  /** Floci backs each instance with a Docker container named floci-ec2-<id>. */
  const copyExec = async (instanceId: string) => {
    const cmd = `docker exec -it floci-ec2-${instanceId} sh`;
    try {
      await navigator.clipboard.writeText(cmd);
      toast.success(t("ec2.execCopied"));
    } catch {
      toast.error(cmd);
    }
  };

  const instances = useQuery({
    queryKey: ["ec2-instances"],
    queryFn: api.listInstances,
    // Poll while any instance is mid-transition (pending → running, stopping → stopped, …)
    // so launch/start/stop results show up without a manual refresh; stop once all are stable.
    refetchInterval: (q) =>
      q.state.data?.some((i) => TRANSITIONAL_STATES.has(i.state)) ? 3000 : false,
  });
  const current = instances.data?.find((i) => i.instanceId === selected) ?? null;

  const action = useMutation({
    mutationFn: ({ kind, id }: { kind: Ec2InstanceAction; id: string }) => api.runAction(kind, id),
    onSuccess: (_d, { kind }) => {
      toast.success(t("ec2.actionRequested", { action: t(`ec2.action.${kind}`) }));
      qc.invalidateQueries({ queryKey: ["ec2-instances"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const can = (kind: Ec2InstanceAction): boolean => {
    if (!current) return false;
    switch (kind) {
      case "start":
        return current.state === "stopped";
      case "stop":
      case "reboot":
        return current.state === "running";
      case "terminate":
        return current.state !== "terminated";
    }
  };

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={Server}
        title={t("ec2.heading")}
        subtitle={t("ec2.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["ec2-instances"] })}
        refreshing={instances.isFetching}
        refreshTitle={t("common.refresh")}
        actions={
          <>
            <Button onClick={() => setLaunchOpen(true)}>
              <Plus className="h-4 w-4" /> {t("ec2.launch.button")}
            </Button>
            <Button
              variant="secondary"
              disabled={!can("start") || action.isPending}
              onClick={() => current && action.mutate({ kind: "start", id: current.instanceId })}
            >
              <Play className="h-4 w-4" /> {t("ec2.action.start")}
            </Button>
            <Button
              variant="secondary"
              disabled={!can("stop") || action.isPending}
              onClick={() => current && action.mutate({ kind: "stop", id: current.instanceId })}
            >
              <Square className="h-4 w-4" /> {t("ec2.action.stop")}
            </Button>
            <Button
              variant="secondary"
              disabled={!can("reboot") || action.isPending}
              onClick={() => current && action.mutate({ kind: "reboot", id: current.instanceId })}
            >
              <RotateCw className="h-4 w-4" /> {t("ec2.action.reboot")}
            </Button>
            <Button
              variant="danger"
              disabled={!can("terminate") || action.isPending}
              onClick={() => current && setTerminateTarget(current.instanceId)}
            >
              <Trash2 className="h-4 w-4" /> {t("ec2.action.terminate")}
            </Button>
          </>
        }
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={instances.isLoading}
          isError={instances.isError}
          error={instances.error}
          service="EC2"
          data={instances.data}
          getKey={(i) => i.instanceId}
          empty={{ icon: Server, message: t("ec2.none") }}
          head={
            <tr>
              <Th>{t("ec2.col.name")}</Th>
              <Th>{t("ec2.col.instanceId")}</Th>
              <Th>{t("ec2.col.state")}</Th>
              <Th>{t("ec2.col.type")}</Th>
              <Th>{t("ec2.col.az")}</Th>
              <Th>{t("ec2.col.publicIp")}</Th>
              <Th>{t("ec2.col.privateIp")}</Th>
              <Th>{t("ec2.col.launched")}</Th>
              {backend === "floci" && <Th />}
            </tr>
          }
          row={(i: Ec2InstanceSummary) => (
            <Tr
              key={i.instanceId}
              onClick={() => setSelected(i.instanceId)}
              selected={selected === i.instanceId}
            >
              <Td className="font-medium text-slate-700">{i.name ?? "—"}</Td>
              <Td mono>{i.instanceId}</Td>
              <Td>
                <StateBadge state={i.state} />
              </Td>
              <Td>{i.instanceType ?? "—"}</Td>
              <Td>{i.availabilityZone ?? "—"}</Td>
              <Td mono>{i.publicIp ?? "—"}</Td>
              <Td mono>{i.privateIp ?? "—"}</Td>
              <Td muted>{formatDate(i.launchTime, i18n.language)}</Td>
              {backend === "floci" && (
                <Td className="text-right">
                  {i.state === "running" && (
                    <button
                      type="button"
                      title={t("ec2.execHint")}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyExec(i.instanceId);
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-1 text-[11px] text-slate-500 hover:border-brand hover:text-brand"
                    >
                      <Terminal className="h-3.5 w-3.5" /> {t("ec2.exec")}
                    </button>
                  )}
                </Td>
              )}
            </Tr>
          )}
        />
      </div>

      {current && (
        <Ec2DetailPanel
          key={current.instanceId}
          instanceId={current.instanceId}
          onClose={() => setSelected(null)}
        />
      )}

      <Ec2LaunchModal open={launchOpen} onClose={() => setLaunchOpen(false)} />

      <TerminateModal
        instanceId={terminateTarget}
        onClose={() => setTerminateTarget(null)}
        onConfirm={(id) => {
          action.mutate({ kind: "terminate", id });
          if (selected === id) setSelected(null);
          setTerminateTarget(null);
        }}
      />
    </div>
  );
}

function TerminateModal({
  instanceId,
  onClose,
  onConfirm,
}: {
  instanceId: string | null;
  onClose: () => void;
  onConfirm: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal open={instanceId !== null} onClose={onClose} title={t("ec2.terminateTitle")}>
      <div className="flex flex-col gap-3 text-sm">
        <p>{t("ec2.terminateConfirm", { id: instanceId })}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="danger" onClick={() => instanceId && onConfirm(instanceId)}>
            {t("ec2.action.terminate")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
