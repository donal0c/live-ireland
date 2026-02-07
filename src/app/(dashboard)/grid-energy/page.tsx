import { EirgridLivePanel } from "@/components/grid/eirgrid-live-panel";
import { GridEnergyDashboard } from "@/components/grid/grid-energy-dashboard";

export default function GridEnergyPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grid & Energy</h1>
        <p className="text-sm text-muted-foreground">
          EirGrid demand, generation mix, and grid frequency views.
        </p>
      </div>

      <GridEnergyDashboard />
      <EirgridLivePanel />
    </section>
  );
}
