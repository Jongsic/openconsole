import { useQuery, useQueryClient } from "@tanstack/react-query";
import { HardDrive } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PageHeader, ResourceTable, Td, Th, Tr } from "@/components/kit";
import { api } from "@/lib/ec2-api";
import type { Ec2VolumeSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function VolumesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const volumes = useQuery({ queryKey: ["volumes"], queryFn: api.listVolumes });

  const attachedTo = (v: Ec2VolumeSummary) =>
    v.attachments.length === 0
      ? "—"
      : v.attachments.map((a) => `${a.instanceId}${a.device ? ` (${a.device})` : ""}`).join(", ");

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={HardDrive}
        title={t("volume.heading")}
        subtitle={t("volume.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["volumes"] })}
        refreshing={volumes.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={volumes.isLoading}
          isError={volumes.isError}
          error={volumes.error}
          service="EBS"
          data={volumes.data}
          getKey={(v) => v.volumeId}
          empty={{ icon: HardDrive, message: t("volume.none") }}
          head={
            <tr>
              <Th>{t("volume.col.id")}</Th>
              <Th>{t("volume.col.size")}</Th>
              <Th>{t("volume.col.type")}</Th>
              <Th>{t("volume.col.iops")}</Th>
              <Th>{t("volume.col.state")}</Th>
              <Th>{t("volume.col.encrypted")}</Th>
              <Th>{t("volume.col.az")}</Th>
              <Th>{t("volume.col.attachedTo")}</Th>
              <Th>{t("volume.col.created")}</Th>
            </tr>
          }
          row={(v) => (
            <Tr key={v.volumeId}>
              <Td mono>{v.volumeId}</Td>
              <Td>{v.size} GiB</Td>
              <Td>{v.volumeType ?? "—"}</Td>
              <Td>{v.iops ?? "—"}</Td>
              <Td>{v.state ?? "—"}</Td>
              <Td>{v.encrypted ? "✓" : "—"}</Td>
              <Td>{v.availabilityZone ?? "—"}</Td>
              <Td mono>{attachedTo(v)}</Td>
              <Td muted>{formatDate(v.createTime, i18n.language)}</Td>
            </Tr>
          )}
        />
      </div>
    </div>
  );
}
