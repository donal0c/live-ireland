import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type WarningFeature = {
  properties?: {
    level?: string;
    areaDesc?: string;
  };
};

type WarningsResponse = {
  features?: WarningFeature[];
};

type MetWarningsPayload = {
  warningCount: number;
  severeWarningCount: number;
  areas: string[];
};

export class MetWarningsAdapter extends BaseAdapter<MetWarningsPayload> {
  constructor() {
    super({
      id: "met-warnings",
      title: "Met Eireann Warnings",
      pollIntervalMs: 5 * 60_000,
    });
  }

  protected async fetch(context: AdapterPollContext): Promise<AdapterEnvelope<MetWarningsPayload>> {
    const data = await fetchJson<WarningsResponse>(
      "https://prodapi.metweb.ie/warnings/active",
      context,
    );

    const features = data.features ?? [];
    const severeWarningCount = features.filter((feature) => {
      const level = feature.properties?.level?.toLowerCase();
      return level === "orange" || level === "red";
    }).length;

    const areas = Array.from(
      new Set(features.map((feature) => feature.properties?.areaDesc).filter(Boolean)),
    ) as string[];

    const payload: MetWarningsPayload = {
      warningCount: features.length,
      severeWarningCount,
      areas: areas.slice(0, 10),
    };

    return {
      adapterId: this.id,
      capturedAt: new Date().toISOString(),
      payload,
      recordCount: features.length,
      summary: `${features.length} active warnings`,
    };
  }
}
