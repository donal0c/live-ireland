import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type GbfsStation = {
  num_bikes_available?: number;
  num_docks_available?: number;
};

type GbfsResponse = {
  data?: {
    stations?: GbfsStation[];
  };
};

type DublinBikesPayload = {
  stationCount: number;
  bikesAvailable: number;
  docksAvailable: number;
};

export class DublinBikesAdapter extends BaseAdapter<DublinBikesPayload> {
  constructor() {
    super({
      id: "dublin-bikes",
      title: "Dublin Bikes GBFS",
      pollIntervalMs: 5 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<DublinBikesPayload>> {
    const response = await fetchJson<GbfsResponse>(
      "https://api.cyclocity.fr/contracts/dublin/gbfs/v2/station_status.json",
      context,
    );

    const stations = response.data?.stations ?? [];

    const payload: DublinBikesPayload = {
      stationCount: stations.length,
      bikesAvailable: stations.reduce(
        (sum, station) => sum + (station.num_bikes_available ?? 0),
        0,
      ),
      docksAvailable: stations.reduce(
        (sum, station) => sum + (station.num_docks_available ?? 0),
        0,
      ),
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: stations.length,
      summary: `${payload.bikesAvailable} bikes available`,
    };
  }
}
