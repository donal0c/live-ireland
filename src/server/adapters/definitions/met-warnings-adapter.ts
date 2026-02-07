import { BaseAdapter } from "@/server/adapters/core/base-adapter";
import type { AdapterEnvelope, AdapterPollContext } from "@/server/adapters/core/types";
import { fetchJson } from "@/server/adapters/utils/http";

type WarningFeature = {
  properties?: {
    level?: string;
    areaDesc?: string;
    title?: string;
  };
};

type WarningsResponse = {
  features?: WarningFeature[];
};

type MetWarningsPayload = {
  warningCount: number;
  severeWarningCount: number;
  yellowCount: number;
  orangeCount: number;
  redCount: number;
  areas: string[];
  highlights: Array<{ area: string; level: string; title: string | null }>;
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
    const yellowCount = features.filter(
      (feature) => feature.properties?.level?.toLowerCase() === "yellow",
    ).length;
    const orangeCount = features.filter(
      (feature) => feature.properties?.level?.toLowerCase() === "orange",
    ).length;
    const redCount = features.filter(
      (feature) => feature.properties?.level?.toLowerCase() === "red",
    ).length;

    const areas = Array.from(
      new Set(features.map((feature) => feature.properties?.areaDesc).filter(Boolean)),
    ) as string[];

    const payload: MetWarningsPayload = {
      warningCount: features.length,
      severeWarningCount,
      yellowCount,
      orangeCount,
      redCount,
      areas: areas.slice(0, 10),
      highlights: features.slice(0, 6).map((feature) => ({
        area: feature.properties?.areaDesc ?? "Unknown area",
        level: feature.properties?.level ?? "Unknown",
        title: feature.properties?.title ?? null,
      })),
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
