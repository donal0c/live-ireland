"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@tremor/react";
import * as echarts from "echarts";
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

  const gaugeOption = useMemo<echarts.EChartsOption>(() => {
    const demand = demandQuery.data?.payload?.demandMw ?? 0;
    const generation = generationQuery.data?.payload?.value ?? 0;
    const wind = windQuery.data?.payload?.value ?? 0;
    const frequency = frequencyQuery.data?.payload?.value ?? 0;

    const windPercent = generation > 0 ? Math.min(100, (wind / generation) * 100) : 0;

    const baseGauge: echarts.GaugeSeriesOption = {
      anchor: {
        show: true,
        itemStyle: {
          color: "#374151",
        },
        size: 14,
      },
      axisLabel: { show: false },
      axisLine: {
        lineStyle: {
          color: [[1, "#d1d5db"]],
          width: 20,
        },
      },
      axisTick: { show: false },
      detail: { fontSize: 36, fontWeight: "bold", offsetCenter: [0, "8%"] },
      pointer: {
        itemStyle: {
          color: "#374151",
        },
        length: "70%",
        width: 8,
      },
      progress: {
        itemStyle: {
          color: "#2563eb",
        },
        roundCap: true,
        show: true,
        width: 20,
      },
      splitLine: { show: false },
      title: { fontSize: 20, offsetCenter: [0, "82%"] },
    };

    return {
      animationDuration: 300,
      series: [
        {
          ...baseGauge,
          type: "gauge",
          center: ["20%", "37%"],
          radius: "31%",
          min: 0,
          max: 7000,
          detail: {
            fontSize: 36,
            fontWeight: "bold",
            offsetCenter: [0, "8%"],
            formatter: "{value} MW",
          },
          title: { fontSize: 20, offsetCenter: [0, "82%"] },
          data: [{ value: Math.round(demand), name: "Demand" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["50%", "37%"],
          radius: "31%",
          min: 0,
          max: 7000,
          progress: {
            ...baseGauge.progress,
            itemStyle: { color: "#84cc16" },
          },
          detail: {
            fontSize: 36,
            fontWeight: "bold",
            offsetCenter: [0, "8%"],
            formatter: "{value} MW",
          },
          title: { fontSize: 20, offsetCenter: [0, "82%"] },
          data: [{ value: Math.round(generation), name: "Generation" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["80%", "37%"],
          radius: "31%",
          min: 0,
          max: 100,
          progress: {
            ...baseGauge.progress,
            itemStyle: { color: "#4f46e5" },
          },
          detail: {
            fontSize: 36,
            fontWeight: "bold",
            offsetCenter: [0, "8%"],
            formatter: "{value} %",
          },
          title: { fontSize: 20, offsetCenter: [0, "82%"] },
          data: [{ value: Number(windPercent.toFixed(1)), name: "Wind %" }],
        },
        {
          ...baseGauge,
          type: "gauge",
          center: ["50%", "84%"],
          radius: "29%",
          min: 49,
          max: 51,
          progress: {
            ...baseGauge.progress,
            itemStyle: { color: "#fb923c" },
          },
          detail: {
            fontSize: 36,
            fontWeight: "bold",
            offsetCenter: [0, "8%"],
            formatter: "{value} Hz",
          },
          title: { fontSize: 20, offsetCenter: [0, "82%"] },
          data: [{ value: Number(frequency.toFixed(2)), name: "Frequency" }],
        },
      ],
    };
  }, [
    demandQuery.data?.payload?.demandMw,
    frequencyQuery.data?.payload?.value,
    generationQuery.data?.payload?.value,
    windQuery.data?.payload?.value,
  ]);

  const lineOption = useMemo<echarts.EChartsOption>(() => {
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
      tooltip: { trigger: "axis" },
      legend: { data: ["Demand", "Generation"] },
      xAxis: {
        type: "category",
        data: plottingSeries.map((item) =>
          new Date(item.ts).toLocaleTimeString("en-IE", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
      },
      yAxis: {
        type: "value",
        name: "MW",
      },
      dataZoom: [{ type: "inside" }, { type: "slider" }],
      series: [
        {
          type: "line",
          name: "Demand",
          data: plottingSeries.map((item) => item.demand),
          smooth: true,
          showSymbol: false,
        },
        {
          type: "line",
          name: "Generation",
          data: plottingSeries.map((item) => item.generation),
          smooth: true,
          showSymbol: false,
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
    <section className="dashboard-container space-y-4">
      {hasAnyError ? (
        <DegradedBanner message="One or more grid/energy data feeds are temporarily unavailable. Showing latest available values." />
      ) : null}

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Live Grid Gauges</h2>
        <p className="text-xs text-muted-foreground">
          ECharts real-time gauges for core national energy metrics.
        </p>
        {showCharts ? (
          <EChart className="h-[34rem]" option={gaugeOption} />
        ) : (
          <button
            className="mt-3 rounded-md border px-3 py-2 text-sm"
            onClick={() => setShowCharts(true)}
            type="button"
          >
            Load charts
          </button>
        )}
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Demand vs Generation Stream</h2>
        <p className="text-xs text-muted-foreground">
          Streaming time-series with session DataZoom.
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="grid-range-selector">
              Range
            </label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
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
            <label className="text-xs text-muted-foreground" htmlFor="grid-aggregation-selector">
              Aggregation
            </label>
            <select
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
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
            <label className="text-xs text-muted-foreground" htmlFor="grid-custom-start">
              Custom Start
            </label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              id="grid-custom-start"
              onChange={(event) => setCustomStart(event.target.value)}
              type="datetime-local"
              value={customStart}
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground" htmlFor="grid-custom-end">
              Custom End
            </label>
            <input
              className="mt-1 w-full rounded-md border bg-background px-2 py-1 text-sm"
              id="grid-custom-end"
              onChange={(event) => setCustomEnd(event.target.value)}
              type="datetime-local"
              value={customEnd}
            />
          </div>
        </div>
        {showCharts ? <EChart option={lineOption} /> : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              const payload = JSON.stringify(series, null, 2);
              downloadText("grid-history.json", payload, "application/json");
            }}
            type="button"
          >
            Export JSON
          </button>
          <button
            className="rounded-md border px-2 py-1 text-xs"
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
            className="rounded-md border px-2 py-1 text-xs"
            onClick={() => {
              setSeries([]);
              writeHistoryToStorage([]);
            }}
            type="button"
          >
            Clear Local History
          </button>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Comparative Demand View</h2>
        <p className="text-xs text-muted-foreground">
          This-hour vs previous-hour average demand from local persisted history.
        </p>
        <div className="dashboard-kpi-grid mt-3 grid gap-3 md:grid-cols-3">
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">This Hour Avg</p>
            <p className="text-xl font-semibold">
              {comparativeSummary.thisHourDemand?.toFixed(1) ?? "--"} MW
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Previous Hour Avg</p>
            <p className="text-xl font-semibold">
              {comparativeSummary.previousHourDemand?.toFixed(1) ?? "--"} MW
            </p>
          </div>
          <div className="rounded-md border p-2">
            <p className="text-xs text-muted-foreground">Delta</p>
            <p className="text-xl font-semibold">
              {comparativeSummary.delta === null ? "--" : `${comparativeSummary.delta} MW`}
            </p>
          </div>
        </div>
      </Card>

      <div className="dashboard-kpi-grid grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <p className="text-sm text-muted-foreground">SEMO Latest Price</p>
          <p className="mt-2 text-2xl font-semibold">
            {semoQuery.data?.payload.latestPrice ?? "--"}
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">CO2 Intensity</p>
          <p className="mt-2 text-2xl font-semibold">
            {co2Query.data?.payload.value?.toFixed(1) ?? "--"} gCO2/kWh
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">Interconnectors</p>
          <p className="mt-2 text-sm font-medium">
            EWIC: {interconnectionQuery.data?.payload.ewicMw ?? "--"} MW
          </p>
          <p className="text-sm font-medium">
            Moyle: {interconnectionQuery.data?.payload.moyleMw ?? "--"} MW
          </p>
        </Card>
        <Card>
          <p className="text-sm text-muted-foreground">ESB Outages</p>
          <p className="mt-2 text-2xl font-semibold">
            {esbQuery.data?.payload.outageCount ?? "--"}
          </p>
          <p className="text-xs text-muted-foreground">
            Fault: {esbQuery.data?.payload.faultCount ?? "--"} / Planned:{" "}
            {esbQuery.data?.payload.plannedCount ?? "--"}
          </p>
        </Card>
      </div>

      {showTopologyMap ? (
        <GridEnergyMap
          ewicMw={interconnectionQuery.data?.payload.ewicMw ?? null}
          moyleMw={interconnectionQuery.data?.payload.moyleMw ?? null}
        />
      ) : (
        <Card>
          <h2 className="text-lg font-semibold tracking-tight">Grid Topology Map (Local)</h2>
          <p className="text-xs text-muted-foreground">
            Interconnector routes, key converter sites, and sample wind assets.
          </p>
          <button
            className="mt-3 rounded-md border px-3 py-2 text-sm"
            onClick={() => setShowTopologyMap(true)}
            type="button"
          >
            Load map
          </button>
        </Card>
      )}

      <Card>
        <p className="text-sm text-muted-foreground">Gas Networks Live Map Points</p>
        <p className="mt-2 text-2xl font-semibold">{gasQuery.data?.payload.itemCount ?? "--"}</p>
      </Card>
    </section>
  );
}
