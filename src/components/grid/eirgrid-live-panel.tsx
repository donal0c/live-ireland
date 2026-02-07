"use client";

import { AreaChart, Card } from "@tremor/react";
import { useEffect, useMemo, useState } from "react";

import { trpcClient } from "@/lib/trpc-client";

type DemandPoint = {
  time: string;
  demandMw: number;
};

export function EirgridLivePanel() {
  const [points, setPoints] = useState<DemandPoint[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "error">("connecting");

  useEffect(() => {
    const subscription = trpcClient.dashboard.eirgridDemand.subscribe(
      { replay: 24 },
      {
        onData: (snapshot) => {
          setStatus("live");
          setPoints((existing) => {
            const next = [
              ...existing,
              { demandMw: snapshot.demandMw, time: snapshot.effectiveTime ?? snapshot.capturedAt },
            ];
            return next.slice(-60);
          });
        },
        onError: () => {
          setStatus("error");
        },
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const chartData = useMemo(
    () =>
      points.map((point) => ({
        Demand: point.demandMw,
        Time: new Date(point.time).toLocaleTimeString("en-IE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      })),
    [points],
  );

  return (
    <Card className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">EirGrid Demand Stream (SSE)</h2>
        <p className="text-xs text-muted-foreground">Status: {status}</p>
      </div>
      <AreaChart
        categories={["Demand"]}
        className="h-56"
        data={chartData}
        index="Time"
        noDataText="Waiting for stream data"
      />
    </Card>
  );
}
