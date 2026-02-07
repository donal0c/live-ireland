import type { SupabaseClient } from "@supabase/supabase-js";

import type { AdapterEnvelope } from "@/server/adapters/core/types";
import type { EirgridDemandSnapshot } from "@/server/api/types";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

const isEirgridPayload = (payload: unknown): payload is EirgridDemandSnapshot => {
  if (!payload || typeof payload !== "object") {
    return false;
  }

  return "demandMw" in payload && "effectiveTime" in payload && "capturedAt" in payload;
};

const parseEirgridDate = (value: string | null) => {
  if (!value) {
    return null;
  }

  const [datePart, timePart] = value.split(" ");
  if (!datePart || !timePart) {
    return null;
  }

  const [day, monthToken, year] = datePart.split("-");
  const monthMap: Record<string, string> = {
    Jan: "01",
    Feb: "02",
    Mar: "03",
    Apr: "04",
    May: "05",
    Jun: "06",
    Jul: "07",
    Aug: "08",
    Sep: "09",
    Oct: "10",
    Nov: "11",
    Dec: "12",
  };

  if (!day || !monthToken || !year) {
    return null;
  }

  const month = monthMap[monthToken];
  if (!month) {
    return null;
  }

  return `${year}-${month}-${day.padStart(2, "0")}T${timePart}Z`;
};

export class AdapterDataStore {
  constructor(private readonly supabase: SupabaseClient | null) {}

  get enabled() {
    return this.supabase !== null;
  }

  async storeAdapterSnapshot(adapterId: string, envelope: AdapterEnvelope<unknown>) {
    if (!this.supabase) {
      return;
    }

    await this.supabase.from("adapter_poll_events").insert({
      adapter_id: adapterId,
      observed_at: envelope.capturedAt,
      record_count: envelope.recordCount,
      summary: envelope.summary,
      payload: envelope.payload as Json,
    });

    if (adapterId !== "eirgrid-demand" || !isEirgridPayload(envelope.payload)) {
      return;
    }

    await this.supabase.from("grid_demand_readings").insert({
      observed_at: envelope.payload.capturedAt,
      source_updated_at: parseEirgridDate(envelope.payload.effectiveTime),
      demand_mw: envelope.payload.demandMw,
      region: envelope.payload.region,
      field_name: envelope.payload.fieldName,
    });
  }
}
