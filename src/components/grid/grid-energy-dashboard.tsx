"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@tremor/react";
import * as echarts from "echarts";
import {
  Activity,
  Cable,
  DollarSign,
  Factory,
  Flame,
  Gauge,
  Leaf,
  Wind,
  Zap,
  ZapOff,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";

import { DegradedBanner } from "@/components/ui/degraded-banner";
import { trpcClient } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

type AdapterEnvelope<T> = {
  adapterId: string;
  capturedAt: string;
  payload: T;
  recordCount: number;
  summary: string;
};

type ScalarPayload = {
  value: number;
};

type InterconnectionPayload = {
  ewicMw: number | null;
  moyleMw: number | null;
};

type SemoPayload = {
  latestPrice: number | null;
};

type EsbPayload = {
  outageCount: number;
  faultCount: number;
  plannedCount: number;
};

type GasPayload = {
  itemCount: number;
};

type DemandSnapshot = {
  demandMw: number;
  effectiveTime: string | null;
  capturedAt: string;
};

type HistoryPoint = {
  demand: number;
  generation: number;
  ts: number;
};

const gridHistoryStorageKey = "live_ireland_grid_history_v1";
const GridEnergyMap = dynamic(
  () => import("@/components/grid/grid-energy-map").then((mod) => mod.GridEnergyMap),
  {
    ssr: false,
  },
);

const readHistoryFromStorage = (): HistoryPoint[] => {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(gridHistoryStorageKey);
    if (!raw) {
      return [];
    }

    const parsed = JSON.parse(raw) as HistoryPoint[];
    return parsed.filter(
      (item) =>
        Number.isFinite(item.ts) &&
        Number.isFinite(item.demand) &&
        Number.isFinite(item.generation),
    );
  } catch {
    return [];
  }
};

const writeHistoryToStorage = (history: HistoryPoint[]) => {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(gridHistoryStorageKey, JSON.stringify(history.slice(-10_000)));
};

const aggregateHistory = (history: HistoryPoint[], bucketMs: number): HistoryPoint[] => {
  if (bucketMs <= 0) {
    return history;
  }

  const buckets = new Map<number, { count: number; demand: number; generation: number }>();
  for (const point of history) {
    const bucketStart = Math.floor(point.ts / bucketMs) * bucketMs;
    const current = buckets.get(bucketStart) ?? { count: 0, demand: 0, generation: 0 };
    current.count += 1;
    current.demand += point.demand;
    current.generation += point.generation;
    buckets.set(bucketStart, current);
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, value]) => ({
      ts,
      demand: Number((value.demand / value.count).toFixed(1)),
      generation: Number((value.generation / value.count).toFixed(1)),
    }));
};

const downloadText = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

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

function EChart({ option, className }: { option: echarts.EChartsOption; className?: string }) {
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

  return <div className={cn("h-64 w-full", className)} ref={rootRef} />;
}

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
  unit?: string | undefined;
  subtext?: string | undefined;
  accentColor?: string | undefined;
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

export function GridEnergyDashboard() {
  const demandQuery = useAdapterSnapshot<DemandSnapshot>("eirgrid-demand", 10_000);
  const generationQuery = useAdapterSnapshot<ScalarPayload>("eirgrid-generation", 15_000);
  const windQuery = useAdapterSnapshot<ScalarPayload>("eirgrid-wind", 15_000);
  const frequencyQuery = useAdapterSnapshot<ScalarPayload>("eirgrid-frequency", 10_000);
  const co2Query = useAdapterSnapshot<ScalarPayload>("eirgrid-co2-intensity", 30_000);
  const interconnectionQuery = useAdapterSnapshot<InterconnectionPayload>(
    "eirgrid-interconnection",
    30_000,
  );
  const semoQuery = useAdapterSnapshot<SemoPayload>("semo-market-bm-025", 60_000);
  const esbQuery = useAdapterSnapshot<EsbPayload>("esb-powercheck-outages", 60_000);
  const gasQuery = useAdapterSnapshot<GasPayload>("gas-networks-map", 60_000);

  const [series, setSeries] = useState<HistoryPoint[]>([]);
  const [rangeHours, setRangeHours] = useState("24");
  const [aggregation, setAggregation] = useState("raw");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [showTopologyMap, setShowTopologyMap] = useState(false);
  const [showCharts, setShowCharts] = useState(false);
  const hasAnyError = [
    demandQuery,
    generationQuery,
    windQuery,
    frequencyQuery,
    co2Query,
    interconnectionQuery,
    semoQuery,
    esbQuery,
    gasQuery,
  ].some((query) => query.isError);

  useEffect(() => {
    setSeries(readHistoryFromStorage());
  }, []);

  useEffect(() => {
    const demand = demandQuery.data?.payload?.demandMw;
    const generation = generationQuery.data?.payload?.value;
    const capturedAt = demandQuery.data?.capturedAt;

    if (typeof demand !== "number" || typeof generation !== "number" || !capturedAt) {
      return;
    }

    setSeries((current) => {
      const ts = new Date(capturedAt).getTime();
      if (!Number.isFinite(ts)) {
        return current;
      }

      const alreadyExists = current.at(-1)?.ts === ts;
      if (alreadyExists) {
        return current;
      }

      const next = [...current, { demand, generation, ts }];
      const trimmed = next.slice(-10_000);
      writeHistoryToStorage(trimmed);
      return trimmed;
    });
  }, [
    demandQuery.data?.capturedAt,
    demandQuery.data?.payload?.demandMw,
    generationQuery.data?.payload?.value,
  ]);

  const demand = demandQuery.data?.payload?.demandMw ?? 0;
  const generation = generationQuery.data?.payload?.value ?? 0;
  const wind = windQuery.data?.payload?.value ?? 0;
  const frequency = frequencyQuery.data?.payload?.value ?? 0;
  const windPercent = generation > 0 ? Math.min(100, (wind / generation) * 100) : 0;

  const gaugeOption = useMemo<echarts.EChartsOption>(() => {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
    const axisLineColor = isDark ? "rgba(255,255,255,0.08)" : "#e5e7eb";
    const textColor = isDark ? "#e0e0e8" : "#1f2937";
    const pointerColor = isDark ? "#a0a0b0" : "#374151";
    const anchorColor = isDark ? "#a0a0b0" : "#374151";

    const baseGauge: echarts.GaugeSeriesOption = {
      anchor: {
        show: true,
        itemStyle: { color: anchorColor },
        size: 12,
      },
      axisLabel: { show: false },
      axisLine: {
        lineStyle: {
          color: [[1, axisLineColor]],
          width: 16,
        },
      },
      axisTick: { show: false },
      detail: {
        fontSize: 28,
        fontWeight: "bold",
        offsetCenter: [0, "8%"],
        color: textColor,
      },
      pointer: {
        itemStyle: { color: pointerColor },
        length: "65%",
        width: 6,
      },
      progress: {
        itemStyle: { color: "#3b82f6" },
        roundCap: true,
        show: true,
        width: 16,
      },
      splitLine: { show: false },
      title: {
        fontSize: 14,
        offsetCenter: [0, "78%"],
        color: isDark ? "#8888a0" : "#6b7280",
      },
    };

    return {
      animationDuration: 400,
      animationEasingUpdate: "cubicOut",
      series: [
        {
          ...baseGauge,
          type: "gauge",
          center: ["20%", "37%"],
          radius: "31%",
          min: 0,
          max: 7000,
          detail: { ...baseGauge.detail, formatter: "{value} MW" },
          title: { ...baseGauge.title },
          data: [{ value: Math.round(demand), name: "Demand" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["50%", "37%"],
          radius: "31%",
          min: 0,
          max: 7000,
          progress: { ...baseGauge.progress, itemStyle: { color: "#22c55e" } },
          detail: { ...baseGauge.detail, formatter: "{value} MW" },
          title: { ...baseGauge.title },
          data: [{ value: Math.round(generation), name: "Generation" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["80%", "37%"],
          radius: "31%",
          min: 0,
          max: 100,
          progress: { ...baseGauge.progress, itemStyle: { color: "#6366f1" } },
          detail: { ...baseGauge.detail, formatter: "{value} %" },
          title: { ...baseGauge.title },
          data: [{ value: Number(windPercent.toFixed(1)), name: "Wind %" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["50%", "84%"],
          radius: "27%",
          min: 49,
          max: 51,
          progress: { ...baseGauge.progress, itemStyle: { color: "#f59e0b" } },
          detail: { ...baseGauge.detail, formatter: "{value} Hz" },
          title: { ...baseGauge.title },
          data: [{ value: Number(frequency.toFixed(2)), name: "Frequency" }],
        },
      ],
    };
  }, [demand, frequency, generation, windPercent]);

  const lineOption = useMemo<echarts.EChartsOption>(() => {
    const isDark = typeof window !== "undefined" && document.documentElement.classList.contains("dark");
    const now = Date.now();
    const rangeWindowMs =
      rangeHours === "all"
        ? Number.POSITIVE_INFINITY
        : Number.parseInt(rangeHours, 10) * 60 * 60 * 1000;

    const startTs = customStart ? new Date(customStart).getTime() : now - rangeWindowMs;
    const endTs = customEnd ? new Date(customEnd).getTime() : now;

    const filtered = series.filter((point) => {
      if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
        return true;
      }
      return point.ts >= startTs && point.ts <= endTs;
    });

    const bucketMs =
      aggregation === "5m"
        ? 5 * 60 * 1000
        : aggregation === "15m"
          ? 15 * 60 * 1000
          : aggregation === "60m"
            ? 60 * 60 * 1000
            : 0;

    const plottingSeries = aggregateHistory(filtered, bucketMs);

    return {
      animation: false,
      tooltip: {
        trigger: "axis",
        backgroundColor: isDark ? "rgba(20,20,35,0.95)" : "rgba(255,255,255,0.95)",
        borderColor: isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)",
        textStyle: { color: isDark ? "#e0e0e8" : "#1f2937", fontSize: 12 },
      },
      legend: {
        data: ["Demand", "Generation"],
        textStyle: { color: isDark ? "#a0a0b0" : "#6b7280", fontSize: 12 },
      },
      grid: { left: "3%", right: "4%", bottom: "15%", containLabel: true },
      xAxis: {
        type: "category",
        data: plottingSeries.map((item) =>
          new Date(item.ts).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
        axisLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.1)" : "#e5e7eb" } },
        axisLabel: { color: isDark ? "#888" : "#9ca3af", fontSize: 11 },
      },
      yAxis: {
        type: "value",
        name: "MW",
        nameTextStyle: { color: isDark ? "#888" : "#9ca3af", fontSize: 11 },
        axisLine: { show: false },
        splitLine: { lineStyle: { color: isDark ? "rgba(255,255,255,0.05)" : "#f3f4f6" } },
        axisLabel: { color: isDark ? "#888" : "#9ca3af", fontSize: 11 },
      },
      dataZoom: [{ type: "inside" }, { type: "slider" }],
      series: [
        {
          type: "line",
          name: "Demand",
          data: plottingSeries.map((item) => item.demand),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: "#3b82f6" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(59,130,246,0.2)" },
              { offset: 1, color: "rgba(59,130,246,0.02)" },
            ]),
          },
        },
        {
          type: "line",
          name: "Generation",
          data: plottingSeries.map((item) => item.generation),
          smooth: true,
          showSymbol: false,
          lineStyle: { width: 2, color: "#22c55e" },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: "rgba(34,197,94,0.15)" },
              { offset: 1, color: "rgba(34,197,94,0.02)" },
            ]),
          },
        },
      ],
    };
  }, [aggregation, customEnd, customStart, rangeHours, series]);

  const comparativeSummary = useMemo(() => {
    const now = Date.now();
    const thisHourStart = now - 60 * 60 * 1000;
    const previousHourStart = now - 2 * 60 * 60 * 1000;

    const thisHour = series.filter((point) => point.ts >= thisHourStart && point.ts < now);
    const previousHour = series.filter(
      (point) => point.ts >= previousHourStart && point.ts < thisHourStart,
    );

    const average = (values: number[]) =>
      values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

    const thisHourDemand = average(thisHour.map((point) => point.demand));
    const previousHourDemand = average(previousHour.map((point) => point.demand));

    const delta =
      thisHourDemand === null || previousHourDemand === null
        ? null
        : Number((thisHourDemand - previousHourDemand).toFixed(1));

    return {
      delta,
      previousHourDemand,
      thisHourDemand,
    };
  }, [series]);

  return (
    <section className="dashboard-container space-y-6">
      {hasAnyError ? (
        <DegradedBanner message="One or more grid/energy data feeds are temporarily unavailable. Showing latest available values." />
      ) : null}

      {/* ─── Live Grid Gauges ─── */}
      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Live Grid Gauges</h2>
            <p className="text-xs text-muted-foreground">
              Real-time gauges for core national energy metrics
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="live-dot" />
            <span className="text-xs font-medium text-muted-foreground">Streaming</span>
          </div>
        </div>
        {showCharts ? (
          <EChart className="h-[34rem]" option={gaugeOption} />
        ) : (
          <button
            className="btn-glow mt-4 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => setShowCharts(true)}
            type="button"
          >
            Load charts
          </button>
        )}
      </div>

      {/* ─── KPI cards ─── */}
      <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          icon={DollarSign}
          label="SEMO Price"
          value={semoQuery.data?.payload.latestPrice ?? "--"}
          unit={semoQuery.data?.payload.latestPrice != null ? "EUR/MWh" : undefined}
          accentColor="#f59e0b"
        />
        <KpiCard
          icon={Leaf}
          label="CO2 Intensity"
          value={co2Query.data?.payload.value?.toFixed(1) ?? "--"}
          unit="gCO2/kWh"
          accentColor="#22c55e"
        />
        <KpiCard
          icon={Cable}
          label="Interconnectors"
          value={
            interconnectionQuery.data?.payload.ewicMw != null
              ? `${interconnectionQuery.data.payload.ewicMw}`
              : "--"
          }
          unit="MW"
          subtext={`EWIC: ${interconnectionQuery.data?.payload.ewicMw ?? "--"} / Moyle: ${interconnectionQuery.data?.payload.moyleMw ?? "--"} MW`}
          accentColor="#6366f1"
        />
        <KpiCard
          icon={ZapOff}
          label="ESB Outages"
          value={esbQuery.data?.payload.outageCount ?? "--"}
          subtext={`Fault: ${esbQuery.data?.payload.faultCount ?? "--"} / Planned: ${esbQuery.data?.payload.plannedCount ?? "--"}`}
          accentColor="#ef4444"
        />
      </div>

      {/* ─── Demand vs Generation Stream ─── */}
      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-lg font-bold tracking-tight">Demand vs Generation</h2>
        <p className="text-xs text-muted-foreground">
          Streaming time-series with session DataZoom
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground" htmlFor="grid-range-selector">
              Range
            </label>
            <select
              className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              id="grid-range-selector"
              onChange={(event) => setRangeHours(event.target.value)}
              value={rangeHours}
            >
              <option value="1">Last 1h</option>
              <option value="6">Last 6h</option>
              <option value="24">Last 24h</option>
              <option value="all">All local history</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground" htmlFor="grid-aggregation-selector">
              Aggregation
            </label>
            <select
              className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm transition-colors hover:bg-accent"
              id="grid-aggregation-selector"
              onChange={(event) => setAggregation(event.target.value)}
              value={aggregation}
            >
              <option value="raw">Raw</option>
              <option value="5m">5 minute avg</option>
              <option value="15m">15 minute avg</option>
              <option value="60m">60 minute avg</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground" htmlFor="grid-custom-start">
              Custom Start
            </label>
            <input
              className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
              id="grid-custom-start"
              onChange={(event) => setCustomStart(event.target.value)}
              type="datetime-local"
              value={customStart}
            />
          </div>
          <div>
            <label className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground" htmlFor="grid-custom-end">
              Custom End
            </label>
            <input
              className="mt-1 w-full rounded-lg border bg-card px-3 py-2 text-sm"
              id="grid-custom-end"
              onChange={(event) => setCustomEnd(event.target.value)}
              type="datetime-local"
              value={customEnd}
            />
          </div>
        </div>
        {showCharts ? <EChart option={lineOption} /> : null}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            onClick={() => {
              const payload = JSON.stringify(series, null, 2);
              downloadText("grid-history.json", payload, "application/json");
            }}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium transition-colors hover:bg-accent"
            onClick={() => {
              const csv = [
                "timestamp,demand_mw,generation_mw",
                ...series.map(
                  (point) =>
                    `${new Date(point.ts).toISOString()},${point.demand},${point.generation}`,
                ),
              ].join("\n");
              downloadText("grid-history.csv", csv, "text/csv");
            }}
            type="button"
          >
            Export CSV
          </button>
          <button
            className="rounded-lg border bg-card px-3 py-1.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
            onClick={() => {
              setSeries([]);
              writeHistoryToStorage([]);
            }}
            type="button"
          >
            Clear Local History
          </button>
        </div>
      </div>

      {/* ─── Comparative Demand View ─── */}
      <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
        <h2 className="text-lg font-bold tracking-tight">Comparative Demand</h2>
        <p className="text-xs text-muted-foreground">
          This-hour vs previous-hour average demand from local persisted history
        </p>
        <div className="dashboard-kpi-grid mt-4 grid gap-4 md:grid-cols-3">
          <div className="kpi-card rounded-xl border bg-card/80 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">This Hour Avg</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight metric-value">
              {comparativeSummary.thisHourDemand?.toFixed(1) ?? "--"} <span className="text-sm font-medium text-muted-foreground">MW</span>
            </p>
          </div>
          <div className="kpi-card rounded-xl border bg-card/80 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Previous Hour Avg</p>
            <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight metric-value">
              {comparativeSummary.previousHourDemand?.toFixed(1) ?? "--"} <span className="text-sm font-medium text-muted-foreground">MW</span>
            </p>
          </div>
          <div className="kpi-card rounded-xl border bg-card/80 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Delta</p>
            <p className={cn(
              "mt-1 text-2xl font-bold tabular-nums tracking-tight metric-value",
              comparativeSummary.delta !== null && comparativeSummary.delta > 0 && "text-[oklch(0.65_0.22_25)]",
              comparativeSummary.delta !== null && comparativeSummary.delta < 0 && "text-[oklch(0.65_0.18_155)]",
            )}>
              {comparativeSummary.delta === null
                ? "--"
                : `${comparativeSummary.delta > 0 ? "+" : ""}${comparativeSummary.delta}`}{" "}
              <span className="text-sm font-medium text-muted-foreground">MW</span>
            </p>
          </div>
        </div>
      </div>

      {/* ─── Gas & Map ─── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <KpiCard
          icon={Flame}
          label="Gas Networks Live Points"
          value={gasQuery.data?.payload.itemCount ?? "--"}
          subtext="Entry point flows and pressures"
          accentColor="#f97316"
        />

        {showTopologyMap ? (
          <GridEnergyMap
            ewicMw={interconnectionQuery.data?.payload.ewicMw ?? null}
            moyleMw={interconnectionQuery.data?.payload.moyleMw ?? null}
          />
        ) : (
          <div className="rounded-xl border bg-card/60 p-5 backdrop-blur">
            <h2 className="text-base font-bold tracking-tight">Grid Topology Map</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Interconnector routes, key converter sites, and sample wind assets
            </p>
            <button
              className="btn-glow mt-3 rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
              onClick={() => setShowTopologyMap(true)}
              type="button"
            >
              Load map
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
