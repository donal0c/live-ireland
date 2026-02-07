import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchText } from "@/server/adapters/utils/http";

type IrishRailPayload = {
  trainCount: number;
};

export class IrishRailAdapter extends BaseAdapter<IrishRailPayload> {
  constructor() {
    super({
      id: "irish-rail",
      title: "Irish Rail Trains",
      pollIntervalMs: 90_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<IrishRailPayload>> {
    const xml = await fetchText(
      "https://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML",
      context,
    );

    const trainCount = (xml.match(/<objTrainPositions>/g) ?? []).length;

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload: { trainCount },
      recordCount: trainCount,
      summary: `${trainCount} active trains`,
    };
  }
}
