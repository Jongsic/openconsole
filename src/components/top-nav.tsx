import { Boxes, Settings } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "react-router-dom";
import { hasSection } from "@/lib/backends";
import type { Section } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings";
import { ConnectionDialog } from "./connection-dialog";
import { LanguageSwitch } from "./language-switch";

const TABS: { href: string; label: string; section: Section; comingSoon: boolean }[] = [
  { href: "/s3", label: "S3", section: "s3", comingSoon: false },
  { href: "/compute", label: "Compute", section: "compute", comingSoon: false },
  { href: "/vpc", label: "VPC", section: "vpc", comingSoon: true },
  { href: "/db", label: "DB/Cache", section: "db", comingSoon: true },
  { href: "/function", label: "Function", section: "function", comingSoon: true },
];

export function TopNav() {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const backend = useSettings((s) => s.backend);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4">
      <Link to="/s3" className="flex items-center gap-2 py-2.5">
        <Boxes className="h-6 w-6 text-brand" />
        <span className="text-sm font-semibold text-slate-900">OpenConsole</span>
      </Link>

      <nav className="flex items-center gap-1">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const disabled = !hasSection(backend, tab.section);
          if (disabled) {
            return (
              <span
                key={tab.href}
                title={t("nav.disabledForBackend", { backend: t(`backend.${backend}`) })}
                className="flex cursor-not-allowed items-center gap-1.5 px-3 py-3 text-sm font-medium text-slate-300"
              >
                {tab.label}
              </span>
            );
          }
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-3 text-sm font-medium transition-colors",
                active ? "text-brand" : "text-slate-600 hover:text-slate-900",
              )}
            >
              {tab.label}
              {tab.comingSoon && (
                <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
                  {t("nav.comingSoon")}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-brand" />
              )}
            </Link>
          );
        })}
      </nav>

      <div className="ml-auto flex items-center gap-3">
        <LanguageSwitch />
        <button
          type="button"
          title={t("common.settings")}
          onClick={() => setSettingsOpen(true)}
          className="flex items-center gap-1.5 rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Settings className="h-4 w-4" />
          {t(`backend.${backend}`)}
        </button>
      </div>

      <ConnectionDialog
        mode="settings"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />
    </header>
  );
}
