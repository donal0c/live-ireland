"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Card } from "@tremor/react";
import type { FeatureCollection as GeoJsonFeatureCollection } from "geojson";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef, useState } from "react";

type MetObservation = {
  date?: string;
  humidity?: string;
  name?: string;
  rainfall?: string;
  reportTime?: string;
  temperature?: string;
  windSpeed?: string;
};

type OpwFeature = {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    station_name?: string;
    value?: string;
  };
  type: "Feature";
};

type MapLayerPayload = {
  epa?: FeatureCollection;
  opw?: { features?: OpwFeature[] };
  radarTileUrl?: string | null;
  warnings?: unknown;
};

const metStations = [
  { label: "Dublin Airport", slug: "dublinairport" },
  { label: "Cork", slug: "cork" },
  { label: "Shannon", slug: "shannonairport" },
  { label: "Knock", slug: "irelandwestairportknock" },
  { label: "Valentia", slug: "valentiaobservatory" },
];

const emptyFeatureCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

type FeatureCollection = GeoJsonFeatureCollection;

const asFeatureCollection = (value: unknown): FeatureCollection => {
  if (
    value &&
    typeof value === "object" &&
    "type" in value &&
    (value as { type?: string }).type === "FeatureCollection" &&
    "features" in value &&
    Array.isArray((value as { features?: unknown }).features)
  ) {
    return value as FeatureCollection;
  }

  return emptyFeatureCollection;
};

const opwToGeoJson = (features: OpwFeature[]): FeatureCollection => {
  return {
    type: "FeatureCollection",
    features: features
      .filter((feature) => feature.geometry?.coordinates)
      .map((feature) => ({
        type: "Feature",
        properties: {
          station_name: feature.properties?.station_name ?? "Unknown",
          value: Number.parseFloat(feature.properties?.value ?? "0"),
        },
        geometry: {
          type: "Point",
          coordinates: feature.geometry?.coordinates ?? [0, 0],
        },
      })),
  };
};

const warningFillColorExpression = [
  "match",
  ["downcase", ["coalesce", ["get", "level"], ""]],
  "red",
  "#ef4444",
  "orange",
  "#f97316",
  "yellow",
  "#facc15",
  "#64748b",
] as unknown as maplibregl.ExpressionSpecification;

export function WeatherWaterMap() {
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";
  const mapRef = useRef<maplibregl.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);

  const [selectedStation, setSelectedStation] = useState(metStations[0]?.slug ?? "dublinairport");
  const [stationObservation, setStationObservation] = useState<MetObservation | null>(null);
  const [radarTileUrl, setRadarTileUrl] = useState<string | null>(null);
  const [showRadar, setShowRadar] = useState(false);

  const [opwGeoJson, setOpwGeoJson] = useState<FeatureCollection>(emptyFeatureCollection);
  const [warningGeoJson, setWarningGeoJson] = useState<FeatureCollection>(emptyFeatureCollection);
  const [epaGeoJson, setEpaGeoJson] = useState<FeatureCollection>(emptyFeatureCollection);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      center: [-8.2, 53.4],
      zoom: 6,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("opw", {
        type: "geojson",
        data: emptyFeatureCollection,
      });

      map.addLayer({
        id: "opw-points",
        type: "circle",
        source: "opw",
        paint: {
          "circle-color": [
            "case",
            [">", ["coalesce", ["get", "value"], 0], 4],
            "#dc2626",
            [">", ["coalesce", ["get", "value"], 0], 2],
            "#f97316",
            "#22c55e",
          ],
          "circle-radius": 5,
          "circle-opacity": 0.8,
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 1,
        },
      });

      map.addSource("warnings", {
        type: "geojson",
        data: emptyFeatureCollection,
      });

      map.addLayer({
        id: "warnings-fill",
        type: "fill",
        source: "warnings",
        paint: {
          "fill-color": warningFillColorExpression,
          "fill-opacity": 0.2,
        },
      });

      map.addLayer({
        id: "warnings-outline",
        type: "line",
        source: "warnings",
        paint: {
          "line-color": warningFillColorExpression,
          "line-width": 2,
        },
      });

      map.addSource("epa", {
        type: "geojson",
        data: emptyFeatureCollection,
      });

      map.addLayer({
        id: "epa-points",
        type: "circle",
        source: "epa",
        paint: {
          "circle-color": "#0ea5e9",
          "circle-radius": 4,
          "circle-opacity": 0.75,
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

    const source = map.getSource("opw") as GeoJSONSource | undefined;
    if (source) {
      source.setData(opwGeoJson as never);
    }
  }, [opwGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("warnings") as GeoJSONSource | undefined;
    if (source) {
      source.setData(warningGeoJson as never);
    }
  }, [warningGeoJson]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }

    const source = map.getSource("epa") as GeoJSONSource | undefined;
    if (source) {
      source.setData(epaGeoJson as never);
    }
  }, [epaGeoJson]);

  useEffect(() => {
    const controller = new AbortController();

    const loadStation = async () => {
      const response = await fetch(`${apiBase}/proxy/met/observations/${selectedStation}`, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error("Failed to load station observations");
      }

      const rows = (await response.json()) as MetObservation[];
      setStationObservation(rows.at(-1) ?? null);
    };

    void loadStation().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error("station observation load failed", error);
    });

    return () => {
      controller.abort();
    };
  }, [apiBase, selectedStation]);

  useEffect(() => {
    const controller = new AbortController();

    const loadLayers = async () => {
      const response = await fetch(`${apiBase}/proxy/weather/map-layers`, {
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error("Failed to load map layers");
      }

      const layers = (await response.json()) as MapLayerPayload;
      const opwRaw = layers.opw ?? {};
      const warningsRaw = asFeatureCollection(layers.warnings);
      const epaRaw = layers.epa ?? emptyFeatureCollection;

      setOpwGeoJson(opwToGeoJson(opwRaw.features ?? []));
      setWarningGeoJson(warningsRaw);
      setEpaGeoJson(epaRaw);
      setRadarTileUrl(layers.radarTileUrl ?? null);
    };

    void loadLayers().catch((error) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error("weather map layer load failed", error);
    });

    return () => {
      controller.abort();
    };
  }, [apiBase]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) {
      return;
    }

    const sourceId = "rain-radar";
    const layerId = "rain-radar-layer";

    if (showRadar && radarTileUrl) {
      if (!map.getSource(sourceId)) {
        map.addSource(sourceId, {
          tiles: [radarTileUrl],
          tileSize: 256,
          type: "raster",
        });
      }

      if (!map.getLayer(layerId)) {
        map.addLayer({
          id: layerId,
          type: "raster",
          source: sourceId,
          paint: {
            "raster-opacity": 0.55,
          },
        });
      }

      return;
    }

    if (map.getLayer(layerId)) {
      map.removeLayer(layerId);
    }

    if (map.getSource(sourceId)) {
      map.removeSource(sourceId);
    }
  }, [radarTileUrl, showRadar]);

  const floodHighCount = useMemo(() => {
    return (opwGeoJson.features as Array<{ properties?: { value?: number } }>).filter(
      (feature) => (feature.properties?.value ?? 0) > 4,
    ).length;
  }, [opwGeoJson.features]);

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Weather & Water Map</h2>
          <p className="text-xs text-muted-foreground">
            OPW flood-risk points, Met warning polygons, EPA station markers, and rainfall radar
            overlay.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground" htmlFor="station-selector">
            Station
          </label>
          <select
            className="rounded-md border bg-background px-2 py-1 text-sm"
            id="station-selector"
            onChange={(event) => setSelectedStation(event.target.value)}
            value={selectedStation}
          >
            {metStations.map((station) => (
              <option key={station.slug} value={station.slug}>
                {station.label}
              </option>
            ))}
          </select>

          <button
            className="rounded-md border px-2 py-1 text-xs"
            onClick={() => setShowRadar((current) => !current)}
            type="button"
          >
            {showRadar ? "Hide Radar" : "Show Radar"}
          </button>
        </div>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-4">
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Selected Station Temp</p>
          <p className="text-lg font-semibold">{stationObservation?.temperature ?? "--"} C</p>
          <p className="text-xs text-muted-foreground">{stationObservation?.reportTime ?? "--"}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Selected Station Rainfall</p>
          <p className="text-lg font-semibold">{stationObservation?.rainfall?.trim() || "--"} mm</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Flood Risk (High)</p>
          <p className="text-lg font-semibold">{floodHighCount}</p>
        </div>
        <div className="rounded-md border p-2">
          <p className="text-xs text-muted-foreground">Radar Source</p>
          <p className="text-sm font-medium">RainViewer (temporary)</p>
          <p className="text-xs text-muted-foreground">Met radar endpoint pending</p>
        </div>
      </div>

      <div className="mt-3 h-[420px] overflow-hidden rounded-md border" ref={mapContainerRef} />
    </Card>
  );
}
