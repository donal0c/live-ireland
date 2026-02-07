"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@tremor/react";
import { cellToLatLng, latLngToCell } from "h3-js";
import { AlertOctagon, AlertTriangle, CloudLightning, Info, MapPin, Zap } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DegradedBanner } from "@/components/ui/degraded-banner";
import { trpcClient } from "@/lib/trpc-client";

type AdapterEnvelope<T> = {
  capturedAt: string;
  payload: T;
};

type EsbPayload = {
  faultCount: number;
  outageCount: number;
  plannedCount: number;
};

type MetWarningsPayload = {
  highlights: Array<{ area: string; level: string; title: string | null }>;
  warningCount: number;
};

type EsbOutagesResponse = {
  capturedAt: string;
  outages: Array<{
    id: string;
    lat: number;
    lng: number;
    type: string;
  }>;
};

type OpwFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    station_name?: string;
    value?: string;
  };
};

type WeatherLayersResponse = {
  opw?: { features?: OpwFeature[] };
};

type RailDeparturesResponse = {
  departures: Array<{
    destination: string;
    dueInMins: number;
    lateByMins: number;
    status: string;
  }>;
  stationName: string;
};

type TimelineSeverity = "critical" | "info" | "warning";

type TimelineEntry = {
  id: string;
  region: string;
  severity: TimelineSeverity;
  time: string;
  title: string;
  type: string;
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

type LazyMapInstance = {
  addControl: (control: unknown, position?: string) => void;
  addLayer: (layer: unknown) => void;
  addSource: (id: string, source: unknown) => void;
  getSource: (id: string) => unknown;
  on: (event: string, handler: () => void) => void;
  remove: () => void;
};

const getGeoJsonSource = (source: unknown): { setData: (data: unknown) => void } | null => {
  if (!source || typeof source !== "object" || !("setData" in source)) {
    return null;
  }

  const setData = (source as { setData?: unknown }).setData;
  if (typeof setData !== "function") {
    return null;
  }

  return { setData: setData as (data: unknown) => void };
};

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
      .filter(
        (point) => Number.isFinite(Number(point[latKey])) && Number.isFinite(Number(point[lngKey])),
      )
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

function OutagesMap({
  esbOutages,
  floodAlerts,
}: {
  esbOutages: Array<{ lat: number; lng: number; severity: TimelineSeverity; type: string }>;
  floodAlerts: Array<{ lat: number; lng: number; station: string; value: number }>;
}) {
  const mapRef = useRef<LazyMapInstance | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [maplibreModule, setMaplibreModule] = useState<null | typeof import("maplibre-gl")>(null);

  const esbGeoJson = useMemo(() => toFeatureCollection(esbOutages, "lat", "lng"), [esbOutages]);
  const floodGeoJson = useMemo(() => toFeatureCollection(floodAlerts, "lat", "lng"), [floodAlerts]);

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
      map.addSource("outages-esb", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "outages-esb-layer",
        type: "circle",
        source: "outages-esb",
        paint: {
          "circle-color": [
            "match",
            ["downcase", ["coalesce", ["get", "severity"], ""]],
            "critical",
            "#dc2626",
            "warning",
            "#f59e0b",
            "#22c55e",
          ],
          "circle-radius": 5,
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("outages-flood", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "outages-flood-layer",
        type: "circle",
        source: "outages-flood",
        paint: {
          "circle-color": [
            "case",
            [">=", ["coalesce", ["get", "value"], 0], 4],
            "#dc2626",
            "#f59e0b",
          ],
          "circle-radius": 4.5,
          "circle-opacity": 0.8,
        },
      });
    });

    mapRef.current = map as unknown as LazyMapInstance;

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
    const source = getGeoJsonSource(map.getSource("outages-esb"));
    if (source) {
      source.setData(esbGeoJson as never);
    }
  }, [esbGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = getGeoJsonSource(map.getSource("outages-flood"));
    if (source) {
      source.setData(floodGeoJson as never);
    }
  }, [floodGeoJson]);

  return <div className="h-[420px] overflow-hidden rounded-md border" ref={containerRef} />;
}

const badgeColorForSeverity = (severity: TimelineSeverity) => {
  if (severity === "critical") {
    return "red" as const;
  }
  if (severity === "warning") {
    return "amber" as const;
  }
  return "blue" as const;
};

export function OutagesAlertsDashboard() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  const [severityFilter, setSeverityFilter] = useState<"all" | TimelineSeverity>("all");
  const [regionFilter, setRegionFilter] = useState("all");
  const [showOutagesMap, setShowOutagesMap] = useState(false);

  const esbSummaryQuery = useAdapterSnapshot<EsbPayload>("esb-powercheck-outages", 60_000);
  const warningsSummaryQuery = useAdapterSnapshot<MetWarningsPayload>("met-warnings", 60_000);

  const esbMapQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/outages/esb`);
      if (!response.ok) {
        throw new Error("Failed to load ESB outages");
      }
      return (await response.json()) as EsbOutagesResponse;
    },
    queryKey: ["esb-outages-map"],
    refetchInterval: 60_000,
  });

  const weatherLayersQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/weather/map-layers`);
      if (!response.ok) {
        throw new Error("Failed to load weather layers");
      }
      return (await response.json()) as WeatherLayersResponse;
    },
    queryKey: ["weather-map-layers-outages"],
    refetchInterval: 60_000,
  });

  const railHeustonQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/irish-rail/departures/HSTON`);
      if (!response.ok) {
        throw new Error("Failed to load HSTON departures");
      }
      return (await response.json()) as RailDeparturesResponse;
    },
    queryKey: ["rail-delays", "HSTON"],
    refetchInterval: 60_000,
  });

  const railConnollyQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/proxy/transport/irish-rail/departures/CNLLY`);
      if (!response.ok) {
        throw new Error("Failed to load CNLLY departures");
      }
      return (await response.json()) as RailDeparturesResponse;
    },
    queryKey: ["rail-delays", "CNLLY"],
    refetchInterval: 60_000,
  });

  const floodAlerts = useMemo(() => {
    const byStation = new Map<
      string,
      { lat: number; lng: number; station: string; value: number }
    >();

    for (const feature of weatherLayersQuery.data?.opw?.features ?? []) {
      const station = feature.properties?.station_name ?? "Unknown station";
      const value = Number.parseFloat(feature.properties?.value ?? "0");
      const lat = feature.geometry?.coordinates?.[1] ?? 0;
      const lng = feature.geometry?.coordinates?.[0] ?? 0;

      if (!Number.isFinite(lat) || !Number.isFinite(lng) || value < 2) {
        continue;
      }

      const current = byStation.get(station);
      if (!current || value > current.value) {
        byStation.set(station, { lat, lng, station, value });
      }
    }

    return [...byStation.values()];
  }, [weatherLayersQuery.data?.opw?.features]);

  const timelineEntries = useMemo<TimelineEntry[]>(() => {
    const nowIso = new Date().toISOString();

    const fromWarnings: TimelineEntry[] = (warningsSummaryQuery.data?.payload.highlights ?? []).map(
      (warning, index) => {
        const level = warning.level.toLowerCase();
        const severity: TimelineSeverity =
          level === "red" || level === "orange"
            ? "critical"
            : level === "yellow"
              ? "warning"
              : "info";
        return {
          id: `warning-${index}`,
          region: warning.area,
          severity,
          time: warningsSummaryQuery.data?.capturedAt ?? nowIso,
          title: warning.title ?? "Weather warning",
          type: "Weather",
        };
      },
    );

    const fromEsb: TimelineEntry[] = (esbMapQuery.data?.outages ?? []).map((outage) => {
      const type = outage.type.toLowerCase();
      const severity: TimelineSeverity =
        type === "fault" ? "critical" : type === "planned" ? "warning" : "info";
      return {
        id: `esb-${outage.id}`,
        region: "National Grid",
        severity,
        time: esbMapQuery.data?.capturedAt ?? nowIso,
        title: `ESB ${outage.type} outage`,
        type: "Power",
      };
    });

    const fromFloods: TimelineEntry[] = [...floodAlerts]
      .sort((a, b) => b.value - a.value)
      .slice(0, 20)
      .map((flood, index) => ({
        id: `flood-${index}`,
        region: "Flood Stations",
        severity: flood.value >= 4 ? "critical" : "warning",
        time: nowIso,
        title: `OPW station ${flood.station} at ${flood.value.toFixed(2)}m`,
        type: "Flood",
      }));

    const railEntries = (query: RailDeparturesResponse | undefined): TimelineEntry[] => {
      if (!query) {
        return [];
      }
      return query.departures
        .filter((departure) => departure.lateByMins > 0)
        .slice(0, 5)
        .map((departure, index) => ({
          id: `rail-${query.stationName}-${index}`,
          region: query.stationName,
          severity: departure.lateByMins >= 15 ? "critical" : "warning",
          time: nowIso,
          title: `${departure.destination} delayed by ${departure.lateByMins} min`,
          type: "Rail",
        }));
    };

    return [
      ...fromWarnings,
      ...fromEsb,
      ...fromFloods,
      ...railEntries(railHeustonQuery.data),
      ...railEntries(railConnollyQuery.data),
    ].sort((a, b) => (a.time < b.time ? 1 : -1));
  }, [
    esbMapQuery.data?.capturedAt,
    esbMapQuery.data?.outages,
    floodAlerts,
    railConnollyQuery.data,
    railHeustonQuery.data,
    warningsSummaryQuery.data?.capturedAt,
    warningsSummaryQuery.data?.payload.highlights,
  ]);

  const regions = useMemo(
    () => ["all", ...new Set(timelineEntries.map((entry) => entry.region))],
    [timelineEntries],
  );

  const filteredTimeline = useMemo(() => {
    return timelineEntries.filter((entry) => {
      if (severityFilter !== "all" && entry.severity !== severityFilter) {
        return false;
      }
      if (regionFilter !== "all" && entry.region !== regionFilter) {
        return false;
      }
      return true;
    });
  }, [regionFilter, severityFilter, timelineEntries]);

  const counts = useMemo(() => {
    return {
      critical: timelineEntries.filter((entry) => entry.severity === "critical").length,
      info: timelineEntries.filter((entry) => entry.severity === "info").length,
      warning: timelineEntries.filter((entry) => entry.severity === "warning").length,
    };
  }, [timelineEntries]);

  const esbMapPoints = useMemo(() => {
    return (esbMapQuery.data?.outages ?? []).map((outage) => ({
      lat: outage.lat,
      lng: outage.lng,
      severity:
        outage.type.toLowerCase() === "fault"
          ? ("critical" as TimelineSeverity)
          : outage.type.toLowerCase() === "planned"
            ? ("warning" as TimelineSeverity)
            : ("info" as TimelineSeverity),
      type: outage.type,
    }));
  }, [esbMapQuery.data?.outages]);

  const spatialHotspots = useMemo(() => {
    const points = [
      ...esbMapPoints.map((point) => ({ lat: point.lat, lng: point.lng, source: "Power" })),
      ...floodAlerts.map((point) => ({ lat: point.lat, lng: point.lng, source: "Flood" })),
    ];
    const byCell = new Map<
      string,
      {
        count: number;
        floodCount: number;
        powerCount: number;
        sampleLat: number;
        sampleLng: number;
      }
    >();

    for (const point of points) {
      const cell = latLngToCell(point.lat, point.lng, 7);
      const current = byCell.get(cell) ?? {
        count: 0,
        floodCount: 0,
        powerCount: 0,
        sampleLat: point.lat,
        sampleLng: point.lng,
      };
      current.count += 1;
      if (point.source === "Flood") {
        current.floodCount += 1;
      } else {
        current.powerCount += 1;
      }
      byCell.set(cell, current);
    }

    return [...byCell.entries()]
      .map(([cell, value]) => {
        const [lat, lng] = cellToLatLng(cell);
        return {
          cell,
          count: value.count,
          floodCount: value.floodCount,
          powerCount: value.powerCount,
          lat,
          lng,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [esbMapPoints, floodAlerts]);
  const hasAnyError = [
    esbSummaryQuery,
    warningsSummaryQuery,
    esbMapQuery,
    weatherLayersQuery,
    railHeustonQuery,
    railConnollyQuery,
  ].some((query) => query.isError);

  return (
    <section className="dashboard-container space-y-6">
      {hasAnyError ? (
        <DegradedBanner message="One or more outage/alert feeds are unavailable. Timeline and map are showing partial data." />
      ) : null}
      <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {/* ESB Outages */}
        <div className="group kpi-card rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md" style={{ "--kpi-accent": "#ef4444" } as React.CSSProperties}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">ESB Outages</p>
            <div className="rounded-lg bg-red-500/10 p-1.5">
              <Zap className="h-4 w-4 text-red-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight metric-value">
            {esbSummaryQuery.data?.payload.outageCount ?? "--"}
          </p>
        </div>
        {/* Weather Warnings */}
        <div className="group kpi-card rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md" style={{ "--kpi-accent": "#f59e0b" } as React.CSSProperties}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Weather Warnings</p>
            <div className="rounded-lg bg-amber-500/10 p-1.5">
              <CloudLightning className="h-4 w-4 text-amber-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight metric-value">
            {warningsSummaryQuery.data?.payload.warningCount ?? "--"}
          </p>
        </div>
        {/* Critical Alerts */}
        <div className="group kpi-card rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md" style={{ "--kpi-accent": "#dc2626" } as React.CSSProperties}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Critical Alerts</p>
            <div className="rounded-lg bg-red-600/10 p-1.5">
              <AlertOctagon className="h-4 w-4 text-red-600" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight metric-value">{counts.critical}</p>
        </div>
        {/* Warning Alerts */}
        <div className="group kpi-card rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md" style={{ "--kpi-accent": "#f97316" } as React.CSSProperties}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Warning Alerts</p>
            <div className="rounded-lg bg-orange-500/10 p-1.5">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight metric-value">{counts.warning}</p>
        </div>
        {/* Info Alerts */}
        <div className="group kpi-card rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md" style={{ "--kpi-accent": "#3b82f6" } as React.CSSProperties}>
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Info Alerts</p>
            <div className="rounded-lg bg-blue-500/10 p-1.5">
              <Info className="h-4 w-4 text-blue-500" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight metric-value">{counts.info}</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-lg font-bold tracking-tight">Unified Alert Map</h2>
        <p className="text-xs text-muted-foreground">
          ESB outage locations and OPW flood-threshold stations.
        </p>
        <div className="mt-3">
          {showOutagesMap ? (
            <OutagesMap esbOutages={esbMapPoints} floodAlerts={floodAlerts} />
          ) : (
            <button
              className="btn-glow rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setShowOutagesMap(true)}
              type="button"
            >
              Load map
            </button>
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold tracking-tight">Unified Alert Timeline</h2>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="timeline-severity-filter">
              Filter timeline by severity
            </label>
            <select
              id="timeline-severity-filter"
              className="rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              onChange={(event) =>
                setSeverityFilter(event.target.value as "all" | TimelineSeverity)
              }
              value={severityFilter}
            >
              <option value="all">All severities</option>
              <option value="critical">Critical</option>
              <option value="warning">Warning</option>
              <option value="info">Info</option>
            </select>
            <label className="sr-only" htmlFor="timeline-region-filter">
              Filter timeline by region
            </label>
            <select
              id="timeline-region-filter"
              className="rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              onChange={(event) => setRegionFilter(event.target.value)}
              value={regionFilter}
            >
              {regions.map((region) => (
                <option key={region} value={region}>
                  {region === "all" ? "All regions" : region}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 space-y-2">
          {filteredTimeline.length === 0 ? (
            <p className="text-sm text-muted-foreground">No alerts for current filters.</p>
          ) : (
            filteredTimeline.slice(0, 60).map((entry) => (
              <div
                className="flex items-center justify-between gap-3 rounded-xl border bg-card/80 p-3 transition-colors hover:bg-card/95"
                key={entry.id}
              >
                <div>
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    {entry.type} · {entry.region} ·{" "}
                    {new Date(entry.time).toLocaleTimeString("en-IE")}
                  </p>
                </div>
                <Badge color={badgeColorForSeverity(entry.severity)}>{entry.severity}</Badge>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-lg font-bold tracking-tight">Spatial Hotspots (H3)</h2>
        <p className="text-xs text-muted-foreground">
          Local H3 index aggregation of outage and flood points (resolution 7).
        </p>
        <div className="mt-3 space-y-2">
          {spatialHotspots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hotspot data available.</p>
          ) : (
            spatialHotspots.map((hotspot) => (
              <div
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card/80 p-3 transition-colors hover:bg-card/95"
                key={hotspot.cell}
              >
                <div>
                  <p className="text-sm font-medium">{hotspot.count} signals in one hex</p>
                  <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <MapPin className="mr-1 inline-block h-3 w-3" />
                    {hotspot.cell} · {hotspot.lat.toFixed(3)}, {hotspot.lng.toFixed(3)}
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <Badge color="red">Power {hotspot.powerCount}</Badge>
                  <Badge color="amber">Flood {hotspot.floodCount}</Badge>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
