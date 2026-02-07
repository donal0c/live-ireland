import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type SemoDynamicRecord = {
  StartTime?: string;
  ImbalancePrice?: string | number;
  ShadowPrice?: string | number;
  SMP?: string | number;
};

type SemoDynamicResponse = {
  items?: SemoDynamicRecord[];
  data?: SemoDynamicRecord[];
  Results?: SemoDynamicRecord[];
};

type SemoPayload = {
  recordCount: number;
  latestStartTime: string | null;
  latestPrice: number | null;
};

const toNumber = (value: string | number | undefined) => {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? null : parsed;
  }

  return null;
};

export class SemoMarketAdapter extends BaseAdapter<SemoPayload> {
  constructor() {
    super({
      id: "semo-market-bm-025",
      title: "SEMO Market (BM-025)",
      pollIntervalMs: 30 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<SemoPayload>> {
    const url =
      "https://reports.sem-o.com/api/v1/dynamic/BM-025?page_size=10&sort_by=StartTime&order_by=DESC";
    const response = await fetchJson<SemoDynamicResponse>(url, context);

    const records = response.items ?? response.data ?? response.Results ?? [];
    const latest = records[0];

    const latestPrice =
      toNumber(latest?.ImbalancePrice) ?? toNumber(latest?.ShadowPrice) ?? toNumber(latest?.SMP);

    const payload: SemoPayload = {
      recordCount: records.length,
      latestPrice,
      latestStartTime: latest?.StartTime ?? null,
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: records.length,
      summary: `BM-025 latest ${latestPrice ?? "--"}`,
    };
  }
}
