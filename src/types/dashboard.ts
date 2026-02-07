export type DataFreshness = "live" | "stale" | "offline";

export type DashboardMetric = {
  id: string;
  label: string;
  value: number | null;
  unit: string;
  freshness: DataFreshness;
  updatedAt: string | null;
};
