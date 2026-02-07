"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge, Card } from "@tremor/react";
import * as echarts from "echarts";
import { useEffect, useMemo, useRef, useState } from "react";

import { trpcClient } from "@/lib/trpc-client";

type AdapterEnvelope<T> = {
  adapterId: string;
  capturedAt: string;
  payload: T;
  recordCount: number;
  summary: string;
};

type MetObservationPayload = {
  station: string;
  latestTime: string | null;
  temperature: number | null;
  humidity: number | null;
  windSpeed: number | null;
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

type OpwPayload = { featureCount: number };
type MarinePayload = { latestWaveHeight: number | null; latestTime: string | null };
type EpaPayload = { monitorCount: number; sampleStations: string[] };

function useAdapterSnapshot<T>(adapterId: string, refetchInterval = 30_000) {
  return useQuery({
    queryFn: async () => {
      const result = await trpcClient.dashboard.latestAdapterSnapshot.query({ adapterId });
      return result as AdapterEnvelope<T> | null;
    },
    queryKey: ["adapter-snapshot", adapterId],
    refetchInterval,
  });
}

function EChart({ option }: { option: echarts.EChartsOption }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<echarts.EChartsType | null>(null);

  useEffect(() => {
    if (!rootRef.current) {
      return;
    }

    if (!chartRef.current) {
      chartRef.current = echarts.init(rootRef.current);
    }

    chartRef.current.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(rootRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [option]);

  useEffect(() => {
    return () => {
      chartRef.current?.dispose();
      chartRef.current = null;
    };
  }, []);

  return <div className="h-64 w-full" ref={rootRef} />;
}

const badgeForLevel = (level: string) => {
  const normalized = level.toLowerCase();
  if (normalized === "red") {
    return "red" as const;
  }
  if (normalized === "orange") {
    return "amber" as const;
  }
  if (normalized === "yellow") {
    return "yellow" as const;
  }
  return "gray" as const;
};

export function WeatherWaterDashboard() {
  const observationQuery = useAdapterSnapshot<MetObservationPayload>(
    "met-observations-dublinairport",
    30_000,
  );
  const warningsQuery = useAdapterSnapshot<MetWarningsPayload>("met-warnings", 60_000);
  const opwQuery = useAdapterSnapshot<OpwPayload>("opw-water-levels", 60_000);
  const marineQuery = useAdapterSnapshot<MarinePayload>("marine-iwbnetwork", 60_000);
  const epaQuery = useAdapterSnapshot<EpaPayload>("epa-air-quality", 60_000);
  const observationSnapshot = observationQuery.data;

  const [history, setHistory] = useState<
    Array<{ time: string; temperature: number; humidity: number; wind: number }>
  >([]);

  useEffect(() => {
    const snapshot = observationSnapshot;
    if (!snapshot) {
      return;
    }

    const temperature = snapshot.payload.temperature;
    const humidity = snapshot.payload.humidity;
    const wind = snapshot.payload.windSpeed;

    if (
      typeof temperature !== "number" ||
      typeof humidity !== "number" ||
      typeof wind !== "number"
    ) {
      return;
    }

    setHistory((current) => {
      const time = new Date(snapshot.capturedAt).toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
      });

      const next = [...current, { humidity, temperature, time, wind }];
      return next.slice(-48);
    });
  }, [observationSnapshot]);

  const trendOption = useMemo<echarts.EChartsOption>(() => {
    return {
      animation: false,
      tooltip: { trigger: "axis" },
      legend: { data: ["Temp (C)", "Humidity (%)", "Wind (kt)"] },
      xAxis: {
        type: "category",
        data: history.map((entry) => entry.time),
      },
      yAxis: { type: "value" },
      dataZoom: [{ type: "inside" }, { type: "slider" }],
      series: [
        {
          type: "line",
          name: "Temp (C)",
          data: history.map((entry) => entry.temperature),
          showSymbol: false,
          smooth: true,
        },
        {
          type: "line",
          name: "Humidity (%)",
          data: history.map((entry) => entry.humidity),
          showSymbol: false,
          smooth: true,
        },
        {
          type: "line",
          name: "Wind (kt)",
          data: history.map((entry) => entry.wind),
          showSymbol: false,
          smooth: true,
        },
      ],
    };
  }, [history]);

  const warnings = warningsQuery.data?.payload;

  return (
    <section className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <p className="text-sm text-muted-foreground">Temperature (Dublin Airport)</p>
          <p className="mt-2 text-2xl font-semibold">
            {observationQuery.data?.payload.temperature ?? "--"} C
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Humidity</p>
          <p className="mt-2 text-2xl font-semibold">
            {observationQuery.data?.payload.humidity ?? "--"} %
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Wind Speed</p>
          <p className="mt-2 text-2xl font-semibold">
            {observationQuery.data?.payload.windSpeed ?? "--"} kt
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Active Warnings</p>
          <p className="mt-2 text-2xl font-semibold">{warnings?.warningCount ?? "--"}</p>
          <p className="text-xs text-muted-foreground">
            Y: {warnings?.yellowCount ?? "--"} O: {warnings?.orangeCount ?? "--"} R:{" "}
            {warnings?.redCount ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">OPW Stations</p>
          <p className="mt-2 text-2xl font-semibold">
            {opwQuery.data?.payload.featureCount ?? "--"}
          </p>
        </Card>
      </div>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Weather Signal Trend</h2>
        <p className="text-xs text-muted-foreground">
          Temperature, humidity, and wind trend from live observations.
        </p>
        <EChart option={trendOption} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Active Warning Highlights</h2>
          <div className="mt-3 space-y-2">
            {(warnings?.highlights?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No active warning highlights.</p>
            ) : (
              warnings?.highlights.map((warning, index) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-md border p-2"
                  key={`${warning.area}-${warning.level}-${index}`}
                >
                  <div>
                    <p className="text-sm font-medium">{warning.area}</p>
                    <p className="text-xs text-muted-foreground">
                      {warning.title ?? "Weather warning"}
                    </p>
                  </div>
                  <Badge color={badgeForLevel(warning.level)}>{warning.level}</Badge>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Water, Marine & Air Quality</h2>
          <div className="mt-3 space-y-2 text-sm">
            <p>
              Marine Wave Height:{" "}
              <span className="font-semibold">
                {marineQuery.data?.payload.latestWaveHeight ?? "--"} m
              </span>
            </p>
            <p>
              Marine Sample Time:{" "}
              <span className="font-semibold">{marineQuery.data?.payload.latestTime ?? "--"}</span>
            </p>
            <p>
              EPA Monitors:{" "}
              <span className="font-semibold">{epaQuery.data?.payload.monitorCount ?? "--"}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              Sample stations: {epaQuery.data?.payload.sampleStations?.join(", ") ?? "--"}
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}
