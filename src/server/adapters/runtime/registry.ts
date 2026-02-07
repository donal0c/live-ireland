import type { Adapter } from "@/server/adapters/core/types";
import { DublinBikesAdapter } from "@/server/adapters/definitions/dublin-bikes-adapter";
import { EirgridDemandAdapter } from "@/server/adapters/definitions/eirgrid-demand-adapter";
import { EpaAirQualityAdapter } from "@/server/adapters/definitions/epa-air-quality-adapter";
import { GasNetworksAdapter } from "@/server/adapters/definitions/gas-networks-adapter";
import { IrishRailAdapter } from "@/server/adapters/definitions/irish-rail-adapter";
import { LuasAdapter } from "@/server/adapters/definitions/luas-adapter";
import { MetObservationsAdapter } from "@/server/adapters/definitions/met-observations-adapter";
import { MetWarningsAdapter } from "@/server/adapters/definitions/met-warnings-adapter";
import { OpwWaterLevelsAdapter } from "@/server/adapters/definitions/opw-water-levels-adapter";

export const createAdapterRegistry = (eirgridPollIntervalMs: number): Adapter<unknown>[] => {
  return [
    new EirgridDemandAdapter(eirgridPollIntervalMs),
    new MetWarningsAdapter(),
    new MetObservationsAdapter("dublinairport"),
    new OpwWaterLevelsAdapter(),
    new IrishRailAdapter(),
    new LuasAdapter("MAR"),
    new DublinBikesAdapter(),
    new EpaAirQualityAdapter(),
    new GasNetworksAdapter(),
  ];
};
