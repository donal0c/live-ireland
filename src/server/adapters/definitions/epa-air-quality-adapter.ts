import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type EpaMonitor = {
  station_name?: string;
};

type EpaPayload = {
  monitorCount: number;
  sampleStations: string[];
};

export class EpaAirQualityAdapter extends BaseAdapter<EpaPayload> {
  constructor() {
    super({
      id: "epa-air-quality",
      title: "EPA Air Quality",
      pollIntervalMs: 15 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<EpaPayload>> {
    const monitors = await fetchJson<EpaMonitor[]>(
      "https://airquality.ie/assets/php/get-monitors.php",
      context,
      {
        headers: {
          Referer: "https://airquality.ie/",
        },
      },
    );

    const payload: EpaPayload = {
      monitorCount: monitors.length,
      sampleStations: monitors
        .map((monitor) => monitor.station_name)
        .filter(Boolean)
        .slice(0, 6) as string[],
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: monitors.length,
      summary: `${monitors.length} air quality monitors`,
    };
  }
}
