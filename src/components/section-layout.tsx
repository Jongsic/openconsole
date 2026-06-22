import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";
import { NavLink, Outlet } from "react-router-dom";
import { cn } from "@/lib/utils";
import { ComingSoon } from "./coming-soon";

export type SubNavItem = {
  /** Route path relative to the section (e.g. "instances") */
  path: string;
  labelKey: string;
  icon: ComponentType<{ className?: string }>;
  comingSoon: boolean;
  /** Optional group heading key; consecutive items sharing a group are grouped */
  group?: string;
};

/** A service section: left sub-nav + routed content area. */
export function SectionLayout({
  titleKey,
  icon: TitleIcon,
  items,
}: {
  titleKey: string;
  icon: ComponentType<{ className?: string }>;
  items: SubNavItem[];
}) {
  const { t } = useTranslation();
  let lastGroup: string | undefined;

  return (
    <div className="flex h-full">
      <aside className="flex h-full w-56 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <TitleIcon className="h-5 w-5 text-brand" />
          <span className="text-sm font-semibold text-slate-800">{t(titleKey)}</span>
        </div>
        <nav className="flex-1 overflow-auto p-2">
          <ul className="flex flex-col gap-0.5">
            {items.map((item) => {
              const showHeader = item.group && item.group !== lastGroup;
              lastGroup = item.group;
              return (
                <li key={item.path}>
                  {showHeader && (
                    <div className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {t(item.group as string)}
                    </div>
                  )}
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
                        isActive
                          ? "bg-brand-fg font-semibold text-brand shadow-[inset_2px_0_0_0_theme(colors.brand.DEFAULT)]"
                          : "text-slate-700 hover:bg-slate-100 hover:text-slate-900",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    {item.comingSoon && (
                      <span className="rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-500">
                        {t("nav.comingSoon")}
                      </span>
                    )}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}

/** Placeholder page for a not-yet-implemented sub-nav item (localized label). */
export function SoonPage({ labelKey }: { labelKey: string }) {
  const { t } = useTranslation();
  return <ComingSoon service={t(labelKey)} />;
}
