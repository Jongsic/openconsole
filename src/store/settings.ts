import { create } from "zustand";
import { persist } from "zustand/middleware";
import { type BackendKind, type ConnectionSettings, DEFAULT_SETTINGS } from "@/lib/types";

type SettingsState = {
  settings: ConnectionSettings;
  /** Whether the user has completed the initial setup confirmation */
  configured: boolean;
  /** The last detected/confirmed backend kind */
  backend: BackendKind;
  setSettings: (s: ConnectionSettings) => void;
  setBackend: (b: BackendKind) => void;
  confirm: (s: ConnectionSettings, b: BackendKind) => void;
  reset: () => void;
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_SETTINGS,
      configured: false,
      backend: "none",
      setSettings: (settings) => set({ settings }),
      setBackend: (backend) => set({ backend }),
      confirm: (settings, backend) => set({ settings, backend, configured: true }),
      reset: () => set({ settings: DEFAULT_SETTINGS, configured: false, backend: "none" }),
    }),
    { name: "oc_settings" },
  ),
);
