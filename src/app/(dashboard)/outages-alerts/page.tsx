import { Card } from "@tremor/react";

export default function OutagesAlertsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outages & Alerts</h1>
        <p className="text-sm text-muted-foreground">
          ESB outages and active warning channels for rapid incident awareness.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Active Incidents</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Alert and outage feed integration is set up for next phase.
        </p>
      </Card>
    </section>
  );
}
