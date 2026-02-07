import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchText } from "@/server/adapters/utils/http";

type MarinePayload = {
  recordCount: number;
  latestTime: string | null;
  latestWaveHeight: number | null;
};

const buildMarineCsvUrl = () => {
  const dayAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  return `https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv?station_id,time,WaveHeight&time%3E%3D${encodeURIComponent(dayAgoIso)}`;
};

const parseCsvRows = (csv: string) => {
  const lines = csv
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 3) {
    return [] as Array<{ stationId: string; time: string; waveHeight: number | null }>;
  }

  return lines.slice(2).map((line) => {
    const [stationId, time, waveHeightRaw] = line.split(",");
    const wave = waveHeightRaw ? Number.parseFloat(waveHeightRaw) : Number.NaN;

    return {
      stationId,
      time,
      waveHeight: Number.isNaN(wave) ? null : wave,
    };
  });
};

export class MarineWeatherBuoyAdapter extends BaseAdapter<MarinePayload> {
  constructor() {
    super({
      id: "marine-iwbnetwork",
      title: "Marine Institute Buoy Network",
      pollIntervalMs: 60 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<MarinePayload>> {
    const csv = await fetchText(buildMarineCsvUrl(), context);
    const rows = parseCsvRows(csv);

    const m2Rows = rows.filter((row) => row.stationId === "M2");
    const latest = m2Rows.at(-1) ?? rows.at(-1) ?? null;

    const payload: MarinePayload = {
      latestTime: latest?.time ?? null,
      latestWaveHeight: latest?.waveHeight ?? null,
      recordCount: rows.length,
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: rows.length,
      summary: `Marine wave ${payload.latestWaveHeight ?? "--"} m`,
    };
  }
}
