import type { Adapter } from "@/server/adapters/core/types";
import { DublinBikesAdapter } from "@/server/adapters/definitions/dublin-bikes-adapter";
import { EirgridDemandAdapter } from "@/server/adapters/definitions/eirgrid-demand-adapter";
import { EpaAirQualityAdapter } from "@/server/adapters/definitions/epa-air-quality-adapter";
import { EsbOutagesAdapter } from "@/server/adapters/definitions/esb-outages-adapter";
import { GasNetworksAdapter } from "@/server/adapters/definitions/gas-networks-adapter";
import { IrishRailAdapter } from "@/server/adapters/definitions/irish-rail-adapter";
import { LuasAdapter } from "@/server/adapters/definitions/luas-adapter";
import { MarineWeatherBuoyAdapter } from "@/server/adapters/definitions/marine-weather-buoy-adapter";
import { MetObservationsAdapter } from "@/server/adapters/definitions/met-observations-adapter";
import { MetWarningsAdapter } from "@/server/adapters/definitions/met-warnings-adapter";
import { OpwWaterLevelsAdapter } from "@/server/adapters/definitions/opw-water-levels-adapter";
import { SemoMarketAdapter } from "@/server/adapters/definitions/semo-market-adapter";
import { TiiTrafficAdapter } from "@/server/adapters/definitions/tii-traffic-adapter";

export const createAdapterRegistry = (eirgridPollIntervalMs: number): Adapter<unknown>[] => {
  return [
    new EirgridDemandAdapter(eirgridPollIntervalMs),
    new SemoMarketAdapter(),
    new EsbOutagesAdapter(),
    new MetWarningsAdapter(),
    new MetObservationsAdapter("dublinairport"),
    new OpwWaterLevelsAdapter(),
    new MarineWeatherBuoyAdapter(),
    new IrishRailAdapter(),
    new LuasAdapter("MAR"),
    new TiiTrafficAdapter(),
    new DublinBikesAdapter(),
    new EpaAirQualityAdapter(),
    new GasNetworksAdapter(),
  ];
};
