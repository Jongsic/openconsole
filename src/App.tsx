import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ConnectionDialog } from "@/components/connection-dialog";
import { Providers } from "@/components/providers";
import { TopNav } from "@/components/top-nav";
import { AlbPage } from "@/pages/alb";
import { AsgPage } from "@/pages/asg";
import { Ec2Page } from "@/pages/ec2";
import { S3Page } from "@/pages/s3";
import { useSettings } from "@/store/settings";

export function App() {
  const configured = useSettings((s) => s.configured);
  const s = useSettings((st) => st.settings);
  // Remount the subtree when the connection target changes to reset selection state
  const connectionId = `${s.endpoint}|${s.region}|${s.accessKeyId}`;

  return (
    <Providers>
      <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
        {configured ? (
          <div className="flex h-full flex-col">
            <TopNav />
            <div key={connectionId} className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/s3" element={<S3Page />} />
                <Route path="/ec2" element={<Ec2Page />} />
                <Route path="/alb" element={<AlbPage />} />
                <Route path="/asg" element={<AsgPage />} />
                <Route path="*" element={<Navigate to="/s3" replace />} />
              </Routes>
            </div>
          </div>
        ) : (
          <div className="h-full bg-slate-100" />
        )}

        {/* First run: force the connection dialog when no settings exist in localStorage */}
        <ConnectionDialog mode="setup" open={!configured} onClose={() => {}} />
      </BrowserRouter>
    </Providers>
  );
}
