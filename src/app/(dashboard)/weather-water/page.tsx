import { CloudRain } from "lucide-react";

import { WeatherWaterDashboard } from "@/components/weather/weather-water-dashboard";

export default function WeatherWaterPage() {
  return (
    <section className="section-weather space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.60_0.16_195_/_0.1)] dark:bg-[oklch(0.68_0.16_195_/_0.12)]">
          <CloudRain className="h-5 w-5 text-[oklch(0.60_0.16_195)] dark:text-[oklch(0.68_0.16_195)]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Weather & Water</h1>
          <p className="text-sm text-muted-foreground">
            Met Eireann conditions, warnings, and OPW water level monitoring
          </p>
        </div>
      </div>
      <WeatherWaterDashboard />
    </section>
  );
}
