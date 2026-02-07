import { OutagesAlertsDashboard } from "@/components/outages/outages-alerts-dashboard";

export default function OutagesAlertsPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Outages & Alerts</h1>
        <p className="text-sm text-muted-foreground">
          ESB outages and active warning channels for rapid incident awareness.
        </p>
      </div>
      <OutagesAlertsDashboard />
    </section>
  );
}
