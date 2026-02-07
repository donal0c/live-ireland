import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type OpwGeoJson = {
  features?: unknown[];
};

type OpwPayload = {
  featureCount: number;
};

export class OpwWaterLevelsAdapter extends BaseAdapter<OpwPayload> {
  constructor() {
    super({
      id: "opw-water-levels",
      title: "OPW Water Levels",
      pollIntervalMs: 15 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<OpwPayload>> {
    const data = await fetchJson<OpwGeoJson>("https://waterlevel.ie/geojson/latest/", context);
    const featureCount = data.features?.length ?? 0;

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload: { featureCount },
      recordCount: featureCount,
      summary: `${featureCount} water-level features`,
    };
  }
}
