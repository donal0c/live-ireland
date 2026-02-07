"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@tremor/react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
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
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const esbGeoJson = useMemo(() => toFeatureCollection(esbOutages, "lat", "lng"), [esbOutages]);
  const floodGeoJson = useMemo(() => toFeatureCollection(floodAlerts, "lat", "lng"), [floodAlerts]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [-8.2, 53.4],
      zoom: 6,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

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

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = map.getSource("outages-esb") as GeoJSONSource | undefined;
    if (source) {
      source.setData(esbGeoJson as never);
    }
  }, [esbGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = map.getSource("outages-flood") as GeoJSONSource | undefined;
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
  const hasAnyError = [
    esbSummaryQuery,
    warningsSummaryQuery,
    esbMapQuery,
    weatherLayersQuery,
    railHeustonQuery,
    railConnollyQuery,
  ].some((query) => query.isError);

  return (
    <section className="space-y-4">
      {hasAnyError ? (
        <DegradedBanner message="One or more outage/alert feeds are unavailable. Timeline and map are showing partial data." />
      ) : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-muted-foreground">ESB Outages</p>
          <p className="mt-2 text-2xl font-semibold">
            {esbSummaryQuery.data?.payload.outageCount ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Weather Warnings</p>
          <p className="mt-2 text-2xl font-semibold">
            {warningsSummaryQuery.data?.payload.warningCount ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Critical Alerts</p>
          <p className="mt-2 text-2xl font-semibold">{counts.critical}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Warning Alerts</p>
          <p className="mt-2 text-2xl font-semibold">{counts.warning}</p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Info Alerts</p>
          <p className="mt-2 text-2xl font-semibold">{counts.info}</p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Unified Alert Map</h2>
        <p className="text-xs text-muted-foreground">
          ESB outage locations and OPW flood-threshold stations.
        </p>
        <div className="mt-3">
          <OutagesMap esbOutages={esbMapPoints} floodAlerts={floodAlerts} />
        </div>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Unified Alert Timeline</h2>
          <div className="flex items-center gap-2">
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
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
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
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
                className="flex items-center justify-between gap-3 rounded-md border p-2"
                key={entry.id}
              >
                <div>
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.type} · {entry.region} ·{" "}
                    {new Date(entry.time).toLocaleTimeString("en-IE")}
                  </p>
                </div>
                <Badge color={badgeColorForSeverity(entry.severity)}>{entry.severity}</Badge>
              </div>
            ))
          )}
        </div>
      </Card>
    </section>
  );
}
