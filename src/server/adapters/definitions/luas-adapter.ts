import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchText } from "@/server/adapters/utils/http";

type LuasPayload = {
  tramsDue: number;
  stop: string;
};

export class LuasAdapter extends BaseAdapter<LuasPayload> {
  constructor(private readonly stop = "MAR") {
    super({
      id: `luas-${stop.toLowerCase()}`,
      title: `Luas Forecast (${stop})`,
      pollIntervalMs: 30_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<LuasPayload>> {
    const xml = await fetchText(
      `https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&stop=${this.stop}`,
      context,
    );

    const tramsDue = (xml.match(/<tram /g) ?? []).length;

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload: { tramsDue, stop: this.stop },
      recordCount: tramsDue,
      summary: `${tramsDue} tram entries at ${this.stop}`,
    };
  }
}
