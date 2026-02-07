import { TransportDashboard } from "@/components/transport/transport-dashboard";

export default function TransportPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transport</h1>
        <p className="text-sm text-muted-foreground">
          Irish Rail, Luas, and traffic telemetry scaffolding for real-time ingest.
        </p>
      </div>
      <TransportDashboard />
    </section>
  );
}
