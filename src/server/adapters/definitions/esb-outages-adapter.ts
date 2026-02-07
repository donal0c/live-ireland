import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

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

const ESB_SUBSCRIPTION_KEY = "f713e48af3a746bbb1b110ab69113960";

export class EsbOutagesAdapter extends BaseAdapter<EsbPayload> {
  constructor() {
    super({
      id: "esb-powercheck-outages",
      title: "ESB PowerCheck Outages",
      pollIntervalMs: 5 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<EsbPayload>> {
    const response = await fetchJson<EsbResponse>(
      "https://api.esb.ie/esbn/powercheck/v1.0/outages",
      context,
      {
        headers: {
          "API-Subscription-Key": ESB_SUBSCRIPTION_KEY,
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
