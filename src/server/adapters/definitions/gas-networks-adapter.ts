import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type GasMapResponse = {
  features?: unknown[];
  points?: unknown[];
};

type GasNetworksPayload = {
  itemCount: number;
};

export class GasNetworksAdapter extends BaseAdapter<GasNetworksPayload> {
  constructor() {
    super({
      id: "gas-networks-map",
      title: "Gas Networks Map",
      pollIntervalMs: 60 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<GasNetworksPayload>> {
    const response = await fetchJson<GasMapResponse>(
      "https://www.gasnetworks.ie/api/v1/map",
      context,
    );
    const itemCount = response.features?.length ?? response.points?.length ?? 0;

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload: { itemCount },
      recordCount: itemCount,
      summary: `${itemCount} gas network map items`,
    };
  }
}
