import { Card } from "@tremor/react";

export default function WeatherWaterPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weather & Water</h1>
        <p className="text-sm text-muted-foreground">
          Met Eireann conditions, warnings, and OPW water level monitoring.
        </p>
      </div>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Station Overview</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Placeholders are ready for station conditions and warning states.
        </p>
      </Card>
    </section>
  );
}
