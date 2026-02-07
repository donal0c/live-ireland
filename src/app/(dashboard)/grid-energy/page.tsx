import { Card } from "@tremor/react";

import { EirgridLivePanel } from "@/components/grid/eirgrid-live-panel";

export default function GridEnergyPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Grid & Energy</h1>
        <p className="text-sm text-muted-foreground">
          EirGrid demand, generation mix, and grid frequency views.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <p className="text-sm text-muted-foreground">National Demand</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">-- MW</p>
          <p className="mt-1 text-xs text-muted-foreground">Live feed pending</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Wind Share</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">-- %</p>
          <p className="mt-1 text-xs text-muted-foreground">Live feed pending</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Grid Frequency</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight">-- Hz</p>
          <p className="mt-1 text-xs text-muted-foreground">Live feed pending</p>
        </Card>
      </div>

      <EirgridLivePanel />
    </section>
  );
}
