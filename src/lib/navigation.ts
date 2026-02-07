import type { LucideIcon } from "lucide-react";
import { AlertTriangle, CloudRain, TrainFront, Zap } from "lucide-react";

export type DashboardTab = {
  href: "/grid-energy" | "/weather-water" | "/transport" | "/outages-alerts";
  label: string;
  description: string;
  icon: LucideIcon;
};

export const dashboardTabs: DashboardTab[] = [
  {
    href: "/grid-energy",
    label: "Grid & Energy",
    description: "National grid demand, generation, and frequency.",
    icon: Zap,
  },
  {
    href: "/weather-water",
    label: "Weather & Water",
    description: "Conditions, warnings, and national water levels.",
    icon: CloudRain,
  },
  {
    href: "/transport",
    label: "Transport",
    description: "Rail, road, and public transport live telemetry.",
    icon: TrainFront,
  },
  {
    href: "/outages-alerts",
    label: "Outages & Alerts",
    description: "Power cuts and active infrastructure incidents.",
    icon: AlertTriangle,
  },
];
