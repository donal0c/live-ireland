import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import type { EirgridDemandSnapshot } from "@/server/api/types";
import { fetchLatestEirgridDemand } from "@/server/data/eirgrid";
import { eirgridDemandChannel } from "@/server/realtime/eirgrid-channel";

export class EirgridDemandAdapter extends BaseAdapter<EirgridDemandSnapshot> {
  constructor(pollIntervalMs: number) {
    super({
      id: "eirgrid-demand",
      title: "EirGrid Demand",
      pollIntervalMs,
      minimumDelayMs: 5_000,
    });
  }

  protected async fetch(
    _context: AdapterPollContext,
  ): Promise<AdapterEnvelope<EirgridDemandSnapshot>> {
    const payload = await fetchLatestEirgridDemand();
    eirgridDemandChannel.publish(payload);

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: 1,
      summary: `Demand ${payload.demandMw} MW`,
    };
  }
}
