import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type TiiSite = {
  cosit?: string;
  name?: string;
  location?: {
    lat?: number;
    lng?: number;
  };
};

type TiiPayload = {
  siteCount: number;
  sampleSites: string[];
};

export class TiiTrafficAdapter extends BaseAdapter<TiiPayload> {
  constructor() {
    super({
      id: "tii-tmu-sites",
      title: "TII TMU Sites",
      pollIntervalMs: 5 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<TiiPayload>> {
    const sites = await fetchJson<TiiSite[]>(
      "https://data.tii.ie/Datasets/TrafficCountData/sites/tmu-sites.json",
      context,
    );

    const payload: TiiPayload = {
      siteCount: sites.length,
      sampleSites: sites
        .map((site) => site.name ?? site.cosit)
        .filter(Boolean)
        .slice(0, 6) as string[],
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: sites.length,
      summary: `${sites.length} TMU sites`,
    };
  }
}
