import { Card } from "@tremor/react";

export default function TransportPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transport</h1>
        <p className="text-sm text-muted-foreground">
          Irish Rail, Luas, and traffic telemetry scaffolding for real-time ingest.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Network Status</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Route and vehicle data cards will bind to TanStack Query sources.
        </p>
      </Card>
    </section>
  );
}
