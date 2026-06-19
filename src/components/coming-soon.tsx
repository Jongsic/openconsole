import { Construction } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ComingSoon({ service }: { service: string }) {
  const { t } = useTranslation();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
      <Construction className="h-10 w-10" />
      <p className="text-sm">{t("nav.comingSoonBody", { service })}</p>
    </div>
  );
}
