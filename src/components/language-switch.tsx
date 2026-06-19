import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { type Lang, SUPPORTED_LANGS } from "@/i18n";
import { cn } from "@/lib/utils";

const LABELS: Record<Lang, string> = { en: "EN", ko: "한국어" };

export function LanguageSwitch() {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as Lang;

  return (
    <div className="flex items-center gap-1" title={t("common.language")}>
      <Languages className="h-4 w-4 text-slate-400" />
      <div className="flex overflow-hidden rounded-md border border-slate-200">
        {SUPPORTED_LANGS.map((lng) => (
          <button
            key={lng}
            type="button"
            onClick={() => i18n.changeLanguage(lng)}
            className={cn(
              "px-2 py-1 text-xs font-medium transition-colors",
              current === lng ? "bg-brand text-white" : "bg-white text-slate-500 hover:bg-slate-50",
            )}
          >
            {LABELS[lng]}
          </button>
        ))}
      </div>
    </div>
  );
}
