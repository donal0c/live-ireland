"use client";

import { useQuery } from "@tanstack/react-query";
import { Card } from "@tremor/react";
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

  const [series, setSeries] = useState<Array<{ time: string; demand: number; generation: number }>>(
    [],
  );

  useEffect(() => {
    const demand = demandQuery.data?.payload?.demandMw;
    const generation = generationQuery.data?.payload?.value;
    const capturedAt = demandQuery.data?.capturedAt;

    if (typeof demand !== "number" || typeof generation !== "number" || !capturedAt) {
      return;
    }

    setSeries((current) => {
      const time = new Date(capturedAt).toLocaleTimeString("en-IE", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      const next = [...current, { demand, generation, time }];
      return next.slice(-120);
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

    return {
      animationDuration: 300,
      series: [
        {
          type: "gauge",
          center: ["20%", "45%"],
          radius: "35%",
          min: 0,
          max: 7000,
          progress: { show: true, width: 10 },
          detail: { formatter: "{value} MW", fontSize: 12, offsetCenter: [0, "65%"] },
          title: { offsetCenter: [0, "95%"], fontSize: 12 },
          data: [{ value: Math.round(demand), name: "Demand" }],
        },
        {
          type: "gauge",
          center: ["50%", "45%"],
          radius: "35%",
          min: 0,
          max: 7000,
          progress: { show: true, width: 10 },
          detail: { formatter: "{value} MW", fontSize: 12, offsetCenter: [0, "65%"] },
          title: { offsetCenter: [0, "95%"], fontSize: 12 },
          data: [{ value: Math.round(generation), name: "Generation" }],
        },
        {
          type: "gauge",
          center: ["80%", "45%"],
          radius: "35%",
          min: 0,
          max: 100,
          progress: { show: true, width: 10 },
          detail: { formatter: "{value}%", fontSize: 12, offsetCenter: [0, "65%"] },
          title: { offsetCenter: [0, "95%"], fontSize: 12 },
          data: [{ value: Number(windPercent.toFixed(1)), name: "Wind %" }],
        },
        {
          type: "gauge",
          center: ["50%", "92%"],
          radius: "25%",
          min: 49,
          max: 51,
          progress: { show: true, width: 8 },
          detail: { formatter: "{value} Hz", fontSize: 12, offsetCenter: [0, "65%"] },
          title: { offsetCenter: [0, "95%"], fontSize: 12 },
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
    return {
      animation: false,
      tooltip: { trigger: "axis" },
      legend: { data: ["Demand", "Generation"] },
      xAxis: {
        type: "category",
        data: series.map((item) => item.time),
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
          data: series.map((item) => item.demand),
          smooth: true,
          showSymbol: false,
        },
        {
          type: "line",
          name: "Generation",
          data: series.map((item) => item.generation),
          smooth: true,
          showSymbol: false,
        },
      ],
    };
  }, [series]);

  return (
    <section className="space-y-4">
      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Live Grid Gauges</h2>
        <p className="text-xs text-muted-foreground">
          ECharts real-time gauges for core national energy metrics.
        </p>
        <EChart option={gaugeOption} />
      </Card>

      <Card>
        <h2 className="text-lg font-semibold tracking-tight">Demand vs Generation Stream</h2>
        <p className="text-xs text-muted-foreground">
          Streaming time-series with session DataZoom.
        </p>
        <EChart option={lineOption} />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

      <Card>
        <p className="text-sm text-muted-foreground">Gas Networks Live Map Points</p>
        <p className="mt-2 text-2xl font-semibold">{gasQuery.data?.payload.itemCount ?? "--"}</p>
      </Card>
    </section>
  );
}
