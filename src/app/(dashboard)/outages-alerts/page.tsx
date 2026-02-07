import { AlertTriangle } from "lucide-react";

import { OutagesAlertsDashboard } from "@/components/outages/outages-alerts-dashboard";

export default function OutagesAlertsPage() {
  return (
    <section className="section-outages space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.58_0.22_25_/_0.1)] dark:bg-[oklch(0.68_0.22_25_/_0.12)]">
          <AlertTriangle className="h-5 w-5 text-[oklch(0.58_0.22_25)] dark:text-[oklch(0.68_0.22_25)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outages & Alerts</h1>
          <p className="text-sm text-muted-foreground">
            ESB outages and active warning channels for rapid incident awareness
          </p>
        </div>
      </div>
      <OutagesAlertsDashboard />
    </section>
  );
}
