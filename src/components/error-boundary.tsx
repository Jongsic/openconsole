import { Component, type ErrorInfo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "./ui";

/** Full-screen fallback shown when a render error is caught. Shows the full error — nothing hidden. */
function ErrorFallback({ error, info }: { error: Error; info: ErrorInfo | null }) {
  const { t } = useTranslation();
  const home = `${import.meta.env.BASE_URL}`.replace(/\/$/, "") || "/";

  return (
    <div className="flex h-full items-center justify-center overflow-auto bg-slate-100 p-6">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h1 className="text-lg font-semibold text-red-600">{t("errorPage.title")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("errorPage.body")}</p>
        </div>

        <div className="flex gap-2">
          <Button onClick={() => window.location.reload()}>{t("errorPage.reload")}</Button>
          <Button variant="secondary" onClick={() => window.location.assign(home)}>
            {t("errorPage.home")}
          </Button>
        </div>

        <div>
          <div className="mb-1 text-xs font-medium uppercase text-slate-500">
            {t("errorPage.details")}
          </div>
          <pre className="max-h-[50vh] overflow-auto rounded-md border border-slate-200 bg-slate-50 p-3 font-mono text-[11px] leading-relaxed text-slate-700">
            {error.stack || error.message || String(error)}
            {info?.componentStack ? `\n\nComponent stack:${info.componentStack}` : ""}
          </pre>
        </div>
      </div>
    </div>
  );
}

type State = { error: Error | null; info: ErrorInfo | null };

/** Catches render errors anywhere below it and shows ErrorFallback instead of a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ error, info });
    // Surface in the console too, for devtools.
    console.error("Uncaught render error:", error, info);
  }

  render() {
    if (this.state.error) {
      return <ErrorFallback error={this.state.error} info={this.state.info} />;
    }
    return this.props.children;
  }
}
