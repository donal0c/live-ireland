import { WeatherWaterDashboard } from "@/components/weather/weather-water-dashboard";

export default function WeatherWaterPage() {
  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Weather & Water</h1>
        <p className="text-sm text-muted-foreground">
          Met Eireann conditions, warnings, and OPW water level monitoring.
        </p>
      </div>
      <WeatherWaterDashboard />
    </section>
  );
}
