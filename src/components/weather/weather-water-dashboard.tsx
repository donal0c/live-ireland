"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@tremor/react";
import {
  Activity,
  AlertTriangle,
  CloudRain,
  Droplets,
  Thermometer,
  Waves,
  Wind,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { DegradedBanner } from "@/components/ui/degraded-banner";
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
const WeatherWaterMap = dynamic(
  () => import("@/components/weather/weather-water-map").then((mod) => mod.WeatherWaterMap),
  { ssr: false },
);

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

type EChartsOption = import("echarts").EChartsOption;
type EChartsInstance = import("echarts").EChartsType;

function EChart({ option }: { option: EChartsOption }) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<EChartsInstance | null>(null);
  const [echartsModule, setEchartsModule] = useState<null | typeof import("echarts")>(null);

  useEffect(() => {
    let mounted = true;
    void import("echarts").then((module) => {
      if (mounted) {
        setEchartsModule(module);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!rootRef.current || !echartsModule) {
      return;
    }

    if (!chartRef.current) {
      chartRef.current = echartsModule.init(rootRef.current);
    }

    chartRef.current.setOption(option, true);

    const resizeObserver = new ResizeObserver(() => {
      chartRef.current?.resize();
    });
    resizeObserver.observe(rootRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [echartsModule, option]);

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

function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string;
  subtext?: string;
  accentColor?: string;
}) {
  return (
    <div className="kpi-card group rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg opacity-60 transition-opacity group-hover:opacity-100"
          style={{ backgroundColor: `${accentColor ?? "var(--kpi-accent)"}15` }}
        >
          <Icon
            className="h-4 w-4"
            style={{ color: accentColor ?? "var(--kpi-accent)" }}
          />
        </div>
      </div>
      <div className="mt-2 metric-value">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {unit ? <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span> : null}
      </div>
      {subtext ? (
        <p className="mt-1 text-[11px] text-muted-foreground">{subtext}</p>
      ) : null}
    </div>
  );
}

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
  const hasAnyError = [observationQuery, warningsQuery, opwQuery, marineQuery, epaQuery].some(
    (query) => query.isError,
  );

  const [history, setHistory] = useState<
    Array<{ time: string; temperature: number; humidity: number; wind: number }>
  >([]);
  const [showWeatherMap, setShowWeatherMap] = useState(false);
  const [showWeatherTrend, setShowWeatherTrend] = useState(false);

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

  const trendOption = useMemo<EChartsOption>(() => {
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
    <section className="dashboard-container space-y-6">
      {hasAnyError ? (
        <DegradedBanner message="One or more weather/water sources are unavailable. Map and metrics are showing partial data." />
      ) : null}

      {/* ─── KPI Cards ─── */}
      <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          icon={Thermometer}
          label="Temperature (Dublin Airport)"
          value={observationQuery.data?.payload.temperature ?? "--"}
          unit="C"
          accentColor="#ef4444"
        />
        <KpiCard
          icon={Droplets}
          label="Humidity"
          value={observationQuery.data?.payload.humidity ?? "--"}
          unit="%"
          accentColor="#3b82f6"
        />
        <KpiCard
          icon={Wind}
          label="Wind Speed"
          value={observationQuery.data?.payload.windSpeed ?? "--"}
          unit="kt"
          accentColor="#8b5cf6"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Active Warnings"
          value={warnings?.warningCount ?? "--"}
          subtext={`Y: ${warnings?.yellowCount ?? "--"} O: ${warnings?.orangeCount ?? "--"} R: ${warnings?.redCount ?? "--"}`}
          accentColor="#f59e0b"
        />
        <KpiCard
          icon={Waves}
          label="OPW Stations"
          value={opwQuery.data?.payload.featureCount ?? "--"}
          accentColor="#14b8a6"
        />
      </div>

      {/* ─── Weather Signal Trend ─── */}
      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Weather Signal Trend</h2>
            <p className="text-xs text-muted-foreground">
              Temperature, humidity, and wind trend from live observations.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-xs font-medium text-muted-foreground">Streaming</span>
          </div>
        </div>
        {showWeatherTrend ? (
          <EChart option={trendOption} />
        ) : (
          <button
            className="btn-glow mt-4 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => setShowWeatherTrend(true)}
            type="button"
          >
            Load trend chart
          </button>
        )}
      </div>

      {/* ─── Warnings & Water/Marine/Air Split ─── */}
      <div className="dashboard-split-grid grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
          <h2 className="text-lg font-bold tracking-tight">Active Warning Highlights</h2>
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
        </div>

        <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
          <h2 className="text-lg font-bold tracking-tight">Water, Marine & Air Quality</h2>
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
        </div>
      </div>

      {/* ─── Weather & Water Map ─── */}
      {showWeatherMap ? (
        <WeatherWaterMap />
      ) : (
        <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
          <h2 className="text-lg font-bold tracking-tight">Weather & Water Map</h2>
          <p className="text-xs text-muted-foreground">
            OPW flood-risk points, Met warning polygons, EPA stations, and radar overlay.
          </p>
          <button
            className="btn-glow mt-4 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => setShowWeatherMap(true)}
            type="button"
          >
            Load map
          </button>
        </div>
      )}
    </section>
  );
}
