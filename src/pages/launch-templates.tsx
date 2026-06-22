import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutTemplate } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  DefinitionGrid,
  KV,
  PageHeader,
  PanelHeader,
  ResourceTable,
  StatusBadge,
  TableLoading,
  Td,
  Th,
  Tr,
} from "@/components/kit";
import { ResizableBottomPanel } from "@/components/resizable-bottom-panel";
import { api } from "@/lib/ec2-api";
import type { Ec2LaunchTemplateSummary } from "@/lib/types";
import { formatDate } from "@/lib/utils";

export function LaunchTemplatesPage() {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(null);

  const templates = useQuery({ queryKey: ["launch-templates"], queryFn: api.listLaunchTemplates });
  const current = templates.data?.find((lt) => lt.launchTemplateId === selected) ?? null;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        icon={LayoutTemplate}
        title={t("lt.heading")}
        subtitle={t("lt.subtitle")}
        onRefresh={() => qc.invalidateQueries({ queryKey: ["launch-templates"] })}
        refreshing={templates.isFetching}
        refreshTitle={t("common.refresh")}
      />

      <div className="flex-1 overflow-auto">
        <ResourceTable
          isLoading={templates.isLoading}
          isError={templates.isError}
          error={templates.error}
          service="EC2 launch templates"
          data={templates.data}
          getKey={(lt) => lt.launchTemplateId}
          empty={{ icon: LayoutTemplate, message: t("lt.none") }}
          head={
            <tr>
              <Th>{t("lt.col.name")}</Th>
              <Th>{t("lt.col.id")}</Th>
              <Th>{t("lt.col.default")}</Th>
              <Th>{t("lt.col.latest")}</Th>
              <Th>{t("lt.col.created")}</Th>
            </tr>
          }
          row={(lt: Ec2LaunchTemplateSummary) => (
            <Tr
              key={lt.launchTemplateId}
              onClick={() => setSelected(lt.launchTemplateId)}
              selected={selected === lt.launchTemplateId}
            >
              <Td className="font-medium text-slate-700">{lt.launchTemplateName || "—"}</Td>
              <Td mono>{lt.launchTemplateId}</Td>
              <Td>{lt.defaultVersionNumber ?? "—"}</Td>
              <Td>{lt.latestVersionNumber ?? "—"}</Td>
              <Td muted>{formatDate(lt.createTime, i18n.language)}</Td>
            </Tr>
          )}
        />
      </div>

      {current && (
        <TemplateDetail
          key={current.launchTemplateId}
          launchTemplateId={current.launchTemplateId}
          name={current.launchTemplateName}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function TemplateDetail({
  launchTemplateId,
  name,
  onClose,
}: {
  launchTemplateId: string;
  name: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const version = useQuery({
    queryKey: ["launch-template-version", launchTemplateId],
    queryFn: () => api.getLaunchTemplateVersion(launchTemplateId),
  });

  return (
    <ResizableBottomPanel storageKey="oc_panel_h_lt">
      <PanelHeader onClose={onClose} closeTitle={t("common.close")}>
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="font-mono text-xs text-slate-500">{launchTemplateId}</span>
        {version.data?.versionNumber != null && (
          <StatusBadge tone="neutral">
            {t("lt.defaultVersion", { n: version.data.versionNumber })}
          </StatusBadge>
        )}
      </PanelHeader>

      <div className="flex-1 overflow-auto p-4">
        {version.isLoading ? (
          <TableLoading />
        ) : version.isError ? (
          <p className="text-sm text-red-600">{(version.error as Error).message}</p>
        ) : version.data ? (
          <DefinitionGrid>
            <KV label={t("lt.field.ami")} value={version.data.imageId} mono />
            <KV label={t("lt.field.instanceType")} value={version.data.instanceType} />
            <KV label={t("lt.field.keyName")} value={version.data.keyName} />
            <KV
              label={t("lt.field.securityGroups")}
              value={
                [...version.data.securityGroupIds, ...version.data.securityGroups].join(", ") ||
                null
              }
              mono
            />
            <KV label={t("lt.field.iamRole")} value={version.data.iamInstanceProfileArn} mono />
            <KV
              label={t("lt.field.imdsv2")}
              value={
                version.data.metadataHttpTokens
                  ? `${version.data.metadataHttpTokens}${
                      version.data.metadataHopLimit != null
                        ? ` (hop ${version.data.metadataHopLimit})`
                        : ""
                    }`
                  : null
              }
            />
            <KV
              label={t("lt.field.userData")}
              value={version.data.userDataPresent ? t("common.yes") : t("common.no")}
            />
            <KV
              label={t("lt.field.blockDevices")}
              value={
                version.data.blockDevices
                  .map((b) =>
                    `${b.deviceName ?? "?"}: ${b.size ?? "?"}GiB ${b.volumeType ?? ""}${
                      b.encrypted ? " 🔒" : ""
                    }`.trim(),
                  )
                  .join("  ·  ") || null
              }
              mono
            />
          </DefinitionGrid>
        ) : null}
      </div>
    </ResizableBottomPanel>
  );
}
