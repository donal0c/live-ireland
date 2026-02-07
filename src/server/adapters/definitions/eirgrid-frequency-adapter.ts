import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import type { EirgridScalarSnapshot } from "@/server/api/types";
import { fetchLatestEirgridScalar } from "@/server/data/eirgrid";

export class EirgridFrequencyAdapter extends BaseAdapter<EirgridScalarSnapshot> {
  constructor() {
    super({
      id: "eirgrid-frequency",
      title: "EirGrid Frequency",
      pollIntervalMs: 10_000,
      minimumDelayMs: 5_000,
    });
  }

  protected async fetch(
    _context: AdapterPollContext,
  ): Promise<AdapterEnvelope<EirgridScalarSnapshot>> {
    const payload = await fetchLatestEirgridScalar("frequency", { region: "ALL" });

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: 1,
      summary: `Frequency ${payload.value} Hz`,
    };
  }
}
