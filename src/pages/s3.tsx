import { Database } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BucketSidebar } from "@/components/bucket-sidebar";
import { ObjectBrowser } from "@/components/object-browser";

export function S3Page() {
  const { t } = useTranslation();
  const [bucket, setBucket] = useState<string | null>(null);

  return (
    <div className="flex h-full">
      <BucketSidebar selected={bucket} onSelect={setBucket} />
      {bucket ? (
        <ObjectBrowser key={bucket} bucket={bucket} />
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-slate-400">
          <Database className="h-10 w-10" />
          <p className="text-sm">{t("bucket.selectPrompt")}</p>
        </div>
      )}
    </div>
  );
}
