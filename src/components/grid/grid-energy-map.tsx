"use client";

import "maplibre-gl/dist/maplibre-gl.css";

import { Card } from "@tremor/react";
import maplibregl, { type GeoJSONSource } from "maplibre-gl";
import { useEffect, useMemo, useRef } from "react";

type GridEnergyMapProps = {
  ewicMw: number | null;
  moyleMw: number | null;
};

type FeatureCollection = {
  features: Array<{
    geometry:
      | { coordinates: [number, number]; type: "Point" }
      | { coordinates: [number, number][]; type: "LineString" };
    properties: Record<string, number | string>;
    type: "Feature";
  }>;
  type: "FeatureCollection";
};

const emptyCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

export function GridEnergyMap({ ewicMw, moyleMw }: GridEnergyMapProps) {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const lineData = useMemo<FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            id: "ewic",
            name: "East-West Interconnector",
            flowMw: ewicMw ?? 0,
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-6.335, 52.204], // Great Island, IE
              [-4.99, 53.3], // Deeside, Wales (approx)
            ],
          },
        },
        {
          type: "Feature",
          properties: {
            id: "moyle",
            name: "Moyle Interconnector",
            flowMw: moyleMw ?? 0,
          },
          geometry: {
            type: "LineString",
            coordinates: [
              [-5.803, 55.0], // Ballycronan More, NI (approx)
              [-5.167, 55.01], // Auchencrosh, Scotland (approx)
            ],
          },
        },
      ],
    };
  }, [ewicMw, moyleMw]);

  const pointData = useMemo<FeatureCollection>(() => {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { name: "Great Island Converter", type: "Interconnector" },
          geometry: { type: "Point", coordinates: [-6.335, 52.204] },
        },
        {
          type: "Feature",
          properties: { name: "Moyle Converter (NI)", type: "Interconnector" },
          geometry: { type: "Point", coordinates: [-5.803, 55.0] },
        },
        {
          type: "Feature",
          properties: { name: "Arklow Bank Wind Park", type: "Wind" },
          geometry: { type: "Point", coordinates: [-6.0, 52.77] },
        },
        {
          type: "Feature",
          properties: { name: "Galway Wind Cluster (sample)", type: "Wind" },
          geometry: { type: "Point", coordinates: [-9.0, 53.2] },
        },
      ],
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const map = new maplibregl.Map({
      container: containerRef.current,
      center: [-7.7, 53.4],
      zoom: 5.7,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
    });

    map.addControl(new maplibregl.NavigationControl(), "top-right");

    map.on("load", () => {
      map.addSource("energy-lines", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "energy-lines-layer",
        type: "line",
        source: "energy-lines",
        paint: {
          "line-color": [
            "case",
            [">=", ["abs", ["coalesce", ["get", "flowMw"], 0]], 500],
            "#dc2626",
            [">=", ["abs", ["coalesce", ["get", "flowMw"], 0]], 200],
            "#f59e0b",
            "#2563eb",
          ],
          "line-opacity": 0.9,
          "line-width": 4,
        },
      });

      map.addSource("energy-points", { type: "geojson", data: emptyCollection });
      map.addLayer({
        id: "energy-points-layer",
        type: "circle",
        source: "energy-points",
        paint: {
          "circle-color": ["match", ["get", "type"], "Wind", "#22c55e", "#0ea5e9"],
          "circle-radius": 5,
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 1,
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
    const source = map.getSource("energy-lines") as GeoJSONSource | undefined;
    if (source) {
      source.setData(lineData as never);
    }
  }, [lineData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) {
      return;
    }
    const source = map.getSource("energy-points") as GeoJSONSource | undefined;
    if (source) {
      source.setData(pointData as never);
    }
  }, [pointData]);

  return (
    <Card>
      <h2 className="text-lg font-semibold tracking-tight">Grid Topology Map (Local)</h2>
      <p className="text-xs text-muted-foreground">
        Interconnector routes, key converter sites, and sample wind assets.
      </p>
      <div className="mt-3 h-[380px] overflow-hidden rounded-md border" ref={containerRef} />
    </Card>
  );
}
