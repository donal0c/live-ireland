import { create } from "zustand";

export type DashboardTabKey = "grid-energy" | "weather-water" | "transport" | "outages-alerts";

type UiState = {
  activeTab: DashboardTabKey;
  lastUpdatedAt: string | null;
  sidebarOpen: boolean;
  setActiveTab: (tab: DashboardTabKey) => void;
  setSidebarOpen: (open: boolean) => void;
  markUpdatedNow: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  activeTab: "grid-energy",
  lastUpdatedAt: null,
  sidebarOpen: false,
  setActiveTab: (tab) => set({ activeTab: tab }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  markUpdatedNow: () => set({ lastUpdatedAt: new Date().toISOString() }),
}));
