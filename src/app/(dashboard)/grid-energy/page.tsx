import { Zap } from "lucide-react";

import { EirgridLivePanel } from "@/components/grid/eirgrid-live-panel";
import { GridEnergyDashboard } from "@/components/grid/grid-energy-dashboard";

export default function GridEnergyPage() {
  return (
    <section className="section-grid space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.55_0.22_260_/_0.1)] dark:bg-[oklch(0.65_0.22_260_/_0.12)]">
          <Zap className="h-5 w-5 text-[oklch(0.55_0.22_260)] dark:text-[oklch(0.65_0.22_260)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grid & Energy</h1>
          <p className="text-sm text-muted-foreground">
            EirGrid demand, generation mix, and grid frequency views
          </p>
        </div>
      </div>

      <GridEnergyDashboard />
      <EirgridLivePanel />
    </section>
  );
}
