import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";
import { getRuntimeConfig } from "@/server/config";

type EsbOutage = {
  i?: string;
  t?: string;
};

type EsbResponse = {
  outageMessage?: EsbOutage[];
};

type EsbPayload = {
  outageCount: number;
  faultCount: number;
  plannedCount: number;
};

export class EsbOutagesAdapter extends BaseAdapter<EsbPayload> {
  constructor() {
    super({
      id: "esb-powercheck-outages",
      title: "ESB PowerCheck Outages",
      pollIntervalMs: 5 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<EsbPayload>> {
    const config = getRuntimeConfig();
    const response = await fetchJson<EsbResponse>(
      "https://api.esb.ie/esbn/powercheck/v1.0/outages",
      context,
      {
        headers: {
          "API-Subscription-Key": config.esbSubscriptionKey,
        },
      },
    );

    const outages = response.outageMessage ?? [];

    const payload: EsbPayload = {
      outageCount: outages.length,
      faultCount: outages.filter((outage) => outage.t?.toLowerCase() === "fault").length,
      plannedCount: outages.filter((outage) => outage.t?.toLowerCase() === "planned").length,
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: outages.length,
      summary: `${payload.outageCount} outages`,
    };
  }
}
