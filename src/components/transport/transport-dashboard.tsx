"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@tremor/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { trpcClient } from "@/lib/trpc-client";

type AdapterEnvelope<T> = {
  capturedAt: string;
  payload: T;
};

type IrishRailPayload = { trainCount: number };
type LuasPayload = { stop: string; tramsDue: number };
type DublinBikesPayload = { bikesAvailable: number; docksAvailable: number; stationCount: number };
type TiiPayload = { sampleSites: string[]; siteCount: number };

type TransportOverview = {
  capturedAt: string;
  dublinBikes: Array<{
    availability: number;
    bikes: number;
    capacity: number;
    docks: number;
    id: string;
    lat: number;
    lng: number;
    name: string;
  }>;
  trafficSites: Array<{
    cosit: string;
    lat: number;
    lng: number;
    name: string;
  }>;
  trains: Array<{
    code: string;
    direction: string;
    lat: number;
    lng: number;
    message: string;
    status: string;
  }>;
};

type StationDepartures = {
  departures: Array<{
    code: string;
    destination: string;
    dueInMins: number;
    expectedArrival: string;
    expectedDeparture: string;
    lateByMins: number;
    origin: string;
    status: string;
    trainType: string;
  }>;
  stationCode: string;
  stationName: string;
};

type LuasForecast = {
  created: string | null;
  directions: Array<{
    name: string;
    trams: Array<{
      destination: string;
      dueMins: string;
    }>;
  }>;
  message: string;
  stop: string;
  stopAbv: string;
};

type FeatureCollection = {
  features: Array<{
    geometry: { coordinates: [number, number]; type: "Point" };
    properties: Record<string, number | string>;
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

const emptyCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

const irishRailStations = [
  { code: "HSTON", label: "Dublin Heuston" },
  { code: "CNLLY", label: "Dublin Connolly" },
  { code: "CORK", label: "Cork Kent" },
  { code: "GALWY", label: "Galway Ceannt" },
];

const luasStops = [
  { code: "MAR", label: "Marlborough (Green)" },
  { code: "ABB", label: "Abbey Street (Red)" },
  { code: "STI", label: "Stillorgan (Green)" },
  { code: "TPT", label: "The Point (Red)" },
];

const useAdapterSnapshot = <T,>(adapterId: string, refetchInterval = 30_000) => {
  return useQuery({
    queryFn: async () => {
      const result = await trpcClient.dashboard.latestAdapterSnapshot.query({ adapterId });
      return result as AdapterEnvelope<T> | null;
    },
    queryKey: ["adapter-snapshot", adapterId],
    refetchInterval,
  });
};

const toFeatureCollection = <T extends Record<string, number | string>>(
  points: T[],
  latKey: keyof T,
  lngKey: keyof T,
): FeatureCollection => {
  return {
    type: "FeatureCollection",
    features: points
      .filter((point) => {
        const lat = Number(point[latKey]);
        const lng = Number(point[lngKey]);
        return Number.isFinite(lat) && Number.isFinite(lng);
      })
      .map((point) => ({
        type: "Feature",
        properties: point,
        geometry: {
          type: "Point",
          coordinates: [Number(point[lngKey]), Number(point[latKey])],
        },
      })),
  };
};

function TransportMap({ overview }: { overview: TransportOverview | null }) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maplibreModule, setMaplibreModule] = useState<null | typeof import("maplibre-gl")>(null);

  const [showTrains, setShowTrains] = useState(true);
  const [showBikes, setShowBikes] = useState(true);
  const [showTraffic, setShowTraffic] = useState(true);

  const trainsGeoJson = useMemo(
    () => toFeatureCollection(overview?.trains ?? [], "lat", "lng"),
    [overview],
  );
  const bikesGeoJson = useMemo(
    () => toFeatureCollection(overview?.dublinBikes ?? [], "lat", "lng"),
    [overview],
  );
  const trafficGeoJson = useMemo(
    () => toFeatureCollection(overview?.trafficSites ?? [], "lat", "lng"),
    [overview],
  );

  useEffect(() => {
    let mounted = true;
    void import("maplibre-gl").then((module) => {
      if (mounted) {
        setMaplibreModule(module);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current || !maplibreModule) {
      return;
    }

    const map = new maplibreModule.Map({
      container: containerRef.current,
      center: [-8.2, 53.4],
      zoom: 6,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    });

    map.addControl(new maplibreModule.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("transport-trains", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "transport-trains-layer",
        type: "circle",
        source: "transport-trains",
        paint: {
          "circle-color": "#2563eb",
          "circle-radius": 5.5,
          "circle-stroke-color": "#1e293b",
          "circle-stroke-width": 1.2,
        },
      });

      map.addSource("transport-bikes", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "transport-bikes-layer",
        type: "circle",
        source: "transport-bikes",
        paint: {
          "circle-color": [
            "case",
            [">=", ["coalesce", ["get", "availability"], 0], 0.6],
            "#16a34a",
            [">=", ["coalesce", ["get", "availability"], 0], 0.3],
            "#f59e0b",
            "#ef4444",
          ],
          "circle-radius": 4.8,
          "circle-stroke-color": "#111827",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("transport-traffic", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "transport-traffic-layer",
        type: "circle",
        source: "transport-traffic",
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": 3.8,
          "circle-opacity": 0.7,
        },
      });
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [maplibreModule]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("transport-trains");
    if (source) {
      source.setData(trainsGeoJson as never);
    }
  }, [trainsGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("transport-bikes");
    if (source) {
      source.setData(bikesGeoJson as never);
    }
  }, [bikesGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("transport-traffic");
    if (source) {
      source.setData(trafficGeoJson as never);
    }
  }, [trafficGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("transport-trains-layer")) {
      return;
    }
    map.setLayoutProperty("transport-trains-layer", "visibility", showTrains ? "visible" : "none");
  }, [showTrains]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("transport-bikes-layer")) {
      return;
    }
    map.setLayoutProperty("transport-bikes-layer", "visibility", showBikes ? "visible" : "none");
  }, [showBikes]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer("transport-traffic-layer")) {
      return;
    }
    map.setLayoutProperty(
      "transport-traffic-layer",
      "visibility",
      showTraffic ? "visible" : "none",
    );
  }, [showTraffic]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Transport Operations Map</h2>
          <p className="text-xs text-muted-foreground">
            Irish Rail live positions, Dublin Bikes availability, and TII traffic sites.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <label className="inline-flex items-center gap-1">
            <input checked={showTrains} onChange={() => setShowTrains((v) => !v)} type="checkbox" />
            Trains
          </label>
          <label className="inline-flex items-center gap-1">
            <input checked={showBikes} onChange={() => setShowBikes((v) => !v)} type="checkbox" />
            Bikes
          </label>
          <label className="inline-flex items-center gap-1">
            <input
              checked={showTraffic}
              onChange={() => setShowTraffic((v) => !v)}
              type="checkbox"
            />
            Traffic Sites
          </label>
        </div>
      </div>
      <div className="mt-3 h-[440px] overflow-hidden rounded-md border" ref={containerRef} />
    </Card>
  );
}

export function TransportDashboard() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  const [stationCode, setStationCode] = useState("HSTON");
  const [luasStopCode, setLuasStopCode] = useState("MAR");
  const [showTransportMap, setShowTransportMap] = useState(false);

  const irishRailQuery = useAdapterSnapshot<IrishRailPayload>("irish-rail", 90_000);
  const luasQuery = useAdapterSnapshot<LuasPayload>("luas-mar", 30_000);
  const bikesQuery = useAdapterSnapshot<DublinBikesPayload>("dublin-bikes", 60_000);
  const trafficQuery = useAdapterSnapshot<TiiPayload>("tii-tmu-sites", 60_000);

  const overviewQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/overview`);
      if (!response.ok) {
        throw new Error("Failed to load transport overview");
      }

      return (await response.json()) as TransportOverview;
    },
    queryKey: ["transport-overview"],
    refetchInterval: 60_000,
  });

  const departuresQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(
        `${apiBase}/proxy/transport/irish-rail/departures/${stationCode}`,
      );
      if (!response.ok) {
        throw new Error("Failed to load station departures");
      }
      return (await response.json()) as StationDepartures;
    },
    queryKey: ["irish-rail-departures", stationCode],
    refetchInterval: 60_000,
  });

  const selectedLuasQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/luas/forecast/${luasStopCode}`);
      if (!response.ok) {
        throw new Error("Failed to load Luas forecast");
      }
      return (await response.json()) as LuasForecast;
    },
    queryKey: ["luas-forecast", luasStopCode],
    refetchInterval: 30_000,
  });

  const greenLineStatusQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/luas/forecast/MAR`);
      if (!response.ok) {
        throw new Error("Failed to load Green line status");
      }
      return (await response.json()) as LuasForecast;
    },
    queryKey: ["luas-line-status", "green"],
    refetchInterval: 30_000,
  });

  const redLineStatusQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/luas/forecast/ABB`);
      if (!response.ok) {
        throw new Error("Failed to load Red line status");
      }
      return (await response.json()) as LuasForecast;
    },
    queryKey: ["luas-line-status", "red"],
    refetchInterval: 30_000,
  });

  const bikeAvailability = useMemo(() => {
    const bikes = bikesQuery.data?.payload.bikesAvailable ?? 0;
    const docks = bikesQuery.data?.payload.docksAvailable ?? 0;
    const total = bikes + docks;
    if (total === 0) {
      return 0;
    }
    return Math.round((bikes / total) * 100);
  }, [bikesQuery.data]);

  const luasDataStatus = (luasQuery.data?.payload.tramsDue ?? 0) > 0 ? "LIVE" : "LIMITED";
  const greenLineNormal = (greenLineStatusQuery.data?.message ?? "")
    .toLowerCase()
    .includes("operating normally");
  const redLineNormal = (redLineStatusQuery.data?.message ?? "")
    .toLowerCase()
    .includes("operating normally");
  const hasAnyError = [
    irishRailQuery,
    luasQuery,
    bikesQuery,
    trafficQuery,
    overviewQuery,
    departuresQuery,
    selectedLuasQuery,
    greenLineStatusQuery,
    redLineStatusQuery,
  ].some((query) => query.isError);

  return (
    <section className="dashboard-container space-y-4">
      {hasAnyError ? (
        <DegradedBanner message="One or more transport sources are unavailable. Some map layers and boards may be stale." />
      ) : null}
      <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-muted-foreground">Active Trains</p>
          <p className="mt-2 text-2xl font-semibold">
            {irishRailQuery.data?.payload.trainCount ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Luas Forecast (MAR)</p>
          <p className="mt-2 text-2xl font-semibold">{luasQuery.data?.payload.tramsDue ?? "--"}</p>
          <div className="mt-2">
            <Badge color={luasDataStatus === "LIVE" ? "green" : "amber"}>{luasDataStatus}</Badge>
          </div>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Dublin Bikes Availability</p>
          <p className="mt-2 text-2xl font-semibold">{bikeAvailability}%</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Dublin Bikes Stations</p>
          <p className="mt-2 text-2xl font-semibold">
            {bikesQuery.data?.payload.stationCount ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">TII TMU Sites</p>
          <p className="mt-2 text-2xl font-semibold">
            {trafficQuery.data?.payload.siteCount ?? "--"}
          </p>
        </Card>
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Luas Forecast & Line Status</h2>
            <p className="text-xs text-muted-foreground">
              Live arrivals from Luas forecast feed using stop-level polling.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="luas-stop-selector">
              Stop
            </label>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              id="luas-stop-selector"
              onChange={(event) => setLuasStopCode(event.target.value)}
              value={luasStopCode}
            >
              {luasStops.map((stop) => (
                <option key={stop.code} value={stop.code}>
                  {stop.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Green Line</p>
            <div className="mt-1">
              <Badge color={greenLineNormal ? "green" : "amber"}>
                {greenLineNormal ? "Normal" : "Disruption/Unknown"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {greenLineStatusQuery.data?.message ?? "--"}
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Red Line</p>
            <div className="mt-1">
              <Badge color={redLineNormal ? "green" : "amber"}>
                {redLineNormal ? "Normal" : "Disruption/Unknown"}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {redLineStatusQuery.data?.message ?? "--"}
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Selected Stop</p>
            <p className="text-sm font-medium">{selectedLuasQuery.data?.stop ?? "--"}</p>
            <p className="text-xs text-muted-foreground">
              {selectedLuasQuery.data?.message ?? "--"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {(selectedLuasQuery.data?.directions ?? []).map((direction) => (
            <div className="rounded-md border p-2" key={direction.name}>
              <p className="text-sm font-medium">{direction.name}</p>
              <div className="mt-2 space-y-2">
                {direction.trams.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No trams forecast.</p>
                ) : (
                  direction.trams.slice(0, 6).map((tram) => (
                    <div
                      className="flex items-center justify-between text-sm"
                      key={`${direction.name}-${tram.destination}-${tram.dueMins}`}
                    >
                      <span>{tram.destination}</span>
                      <Badge color="blue">{tram.dueMins || "--"} min</Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {showTransportMap ? (
        <TransportMap overview={overviewQuery.data ?? null} />
      ) : (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Transport Operations Map</h2>
          <p className="text-xs text-muted-foreground">
            Irish Rail live positions, Dublin Bikes availability, and TII traffic sites.
          </p>
          <button
            className="mt-3 rounded-md border px-3 py-2 text-sm"
            onClick={() => setShowTransportMap(true)}
            type="button"
          >
            Load map
          </button>
        </Card>
      )}

      <div className="dashboard-split-grid grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Irish Rail Departure Board</h2>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-xs text-muted-foreground" htmlFor="irish-rail-station-selector">
              Station
            </label>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              id="irish-rail-station-selector"
              onChange={(event) => setStationCode(event.target.value)}
              value={stationCode}
            >
              {irishRailStations.map((station) => (
                <option key={station.code} value={station.code}>
                  {station.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 space-y-2">
            {(departuresQuery.data?.departures.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No live departures returned.</p>
            ) : (
              departuresQuery.data?.departures.slice(0, 8).map((departure) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                  key={`${departure.code}-${departure.expectedDeparture}-${departure.destination}`}
                >
                  <div>
                    <p className="text-sm font-medium">{departure.destination}</p>
                    <p className="text-xs text-muted-foreground">
                      {departure.code.trim()} · {departure.expectedDeparture} · {departure.status}
                    </p>
                  </div>
                  <Badge color={departure.lateByMins > 0 ? "red" : "green"}>
                    {departure.dueInMins} min
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Traffic Site Sample</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Representative TMU site IDs from the latest transport ingest.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {(trafficQuery.data?.payload.sampleSites ?? []).map((site) => (
              <Badge color="blue" key={site}>
                {site}
              </Badge>
            ))}
            {(trafficQuery.data?.payload.sampleSites.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No sample sites available.</p>
            ) : null}
          </div>
        </Card>
      </div>
    </section>
  );
}
