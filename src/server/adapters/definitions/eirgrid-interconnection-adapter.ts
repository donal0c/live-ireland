import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import type { EirgridInterconnectionSnapshot } from "@/server/api/types";
import { fetchLatestEirgridInterconnection } from "@/server/data/eirgrid";

export class EirgridInterconnectionAdapter extends BaseAdapter<EirgridInterconnectionSnapshot> {
  constructor() {
    super({
      id: "eirgrid-interconnection",
      title: "EirGrid Interconnectors",
      pollIntervalMs: 30_000,
      minimumDelayMs: 5_000,
    });
  }

  protected async fetch(
    _context: AdapterPollContext,
  ): Promise<AdapterEnvelope<EirgridInterconnectionSnapshot>> {
    const payload = await fetchLatestEirgridInterconnection();

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: 2,
      summary: `EWIC ${payload.ewicMw ?? "--"} / Moyle ${payload.moyleMw ?? "--"} MW`,
    };
  }
}
