import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import type { EirgridScalarSnapshot } from "@/server/api/types";
import { fetchLatestEirgridScalar } from "@/server/data/eirgrid";

export class EirgridCo2Adapter extends BaseAdapter<EirgridScalarSnapshot> {
  constructor() {
    super({
      id: "eirgrid-co2-intensity",
      title: "EirGrid CO2 Intensity",
      pollIntervalMs: 60_000,
      minimumDelayMs: 5_000,
    });
  }

  protected async fetch(
    _context: AdapterPollContext,
  ): Promise<AdapterEnvelope<EirgridScalarSnapshot>> {
    const payload = await fetchLatestEirgridScalar("co2intensity", { region: "ALL" });

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: 1,
      summary: `CO2 ${payload.value} gCO2/kWh`,
    };
  }
}
