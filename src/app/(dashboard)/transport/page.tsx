import { TrainFront } from "lucide-react";

import { TransportDashboard } from "@/components/transport/transport-dashboard";

export default function TransportPage() {
  return (
    <section className="section-transport space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.55_0.20_290_/_0.1)] dark:bg-[oklch(0.65_0.20_290_/_0.12)]">
          <TrainFront className="h-5 w-5 text-[oklch(0.55_0.20_290)] dark:text-[oklch(0.65_0.20_290)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Transport</h1>
          <p className="text-sm text-muted-foreground">
            Irish Rail, Luas, and traffic telemetry for real-time ingest
          </p>
        </div>
      </div>
      <TransportDashboard />
    </section>
  );
}
