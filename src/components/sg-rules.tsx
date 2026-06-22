import { useTranslation } from "react-i18next";
import type { Ec2SecurityGroup, Ec2SgRule } from "@/lib/types";

/** Inbound or outbound rule table for one security group. */
export function RuleTable({ title, rules }: { title: string; rules: Ec2SgRule[] }) {
  const { t } = useTranslation();
  const protocol = (p: string) => (p === "-1" ? t("ec2.security.allTraffic") : p);
  const ports = (r: Ec2SgRule) => {
    if (r.fromPort == null && r.toPort == null) return t("ec2.security.allPorts");
    if (r.fromPort === r.toPort) return String(r.fromPort);
    return `${r.fromPort}–${r.toPort}`;
  };

  return (
    <div>
      <div className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {title}
      </div>
      {rules.length === 0 ? (
        <p className="text-sm text-slate-500">{t("ec2.security.noRules")}</p>
      ) : (
        <table className="w-full text-left text-xs">
          <thead className="text-[10px] uppercase tracking-wide text-slate-500">
            <tr>
              <th className="py-1 pr-3 font-semibold">{t("ec2.security.protocol")}</th>
              <th className="py-1 pr-3 font-semibold">{t("ec2.security.ports")}</th>
              <th className="py-1 font-semibold">{t("ec2.security.source")}</th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: rules have no stable id
              <tr key={i} className="border-t border-slate-100">
                <td className="py-1.5 pr-3 text-slate-700">{protocol(r.protocol)}</td>
                <td className="py-1.5 pr-3 text-slate-700">{ports(r)}</td>
                <td className="py-1.5 font-mono text-slate-600">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

/** One security group: header (name/id/description) + inbound & outbound rule tables. */
export function SecurityGroupCard({ group }: { group: Ec2SecurityGroup }) {
  const { t } = useTranslation();
  return (
    <div>
      <div className="mb-2 flex items-baseline gap-2">
        <span className="text-sm font-semibold text-slate-900">{group.groupName}</span>
        <span className="font-mono text-xs text-slate-500">{group.groupId}</span>
        {group.description && <span className="text-xs text-slate-500">— {group.description}</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <RuleTable title={t("ec2.security.inbound")} rules={group.inbound} />
        <RuleTable title={t("ec2.security.outbound")} rules={group.outbound} />
      </div>
    </div>
  );
}
