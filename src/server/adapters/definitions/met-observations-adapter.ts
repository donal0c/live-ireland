import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type StationObservation = {
  station?: string;
  time?: string;
  temperature?: number;
  feels?: number;
  humidity?: number;
  windSpeed?: number;
};

type MetObservationsPayload = {
  station: string;
  latestTime: string | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
};

export class MetObservationsAdapter extends BaseAdapter<MetObservationsPayload> {
  constructor(private readonly stationSlug = "dublinairport") {
    super({
      id: `met-observations-${stationSlug}`,
      title: `Met Observations (${stationSlug})`,
      pollIntervalMs: 10 * 60_000,
    });
  }

  protected async fetch(
    context: AdapterPollContext,
  ): Promise<AdapterEnvelope<MetObservationsPayload>> {
    const rows = await fetchJson<StationObservation[]>(
      `https://prodapi.metweb.ie/observations/${this.stationSlug}/today`,
      context,
    );

    const latest = rows.at(-1);

    const payload: MetObservationsPayload = {
      station: latest?.station ?? this.stationSlug,
      latestTime: latest?.time ?? null,
      temperature: latest?.temperature ?? null,
      humidity: latest?.humidity ?? null,
      windSpeed: latest?.windSpeed ?? null,
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: rows.length,
      summary: `${payload.station} ${payload.temperature ?? "--"}C`,
    };
  }
}
