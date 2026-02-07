"use client";

import { useQuery } from "@tanstack/react-query";
import { AreaChart } from "@tremor/react";
import { useEffect, useMemo, useRef, useState } from "react";

import { trpcClient } from "@/lib/trpc-client";

type DemandPoint = {
  time: string;
  demandMw: number;
};

export function EirgridLivePanel() {
  const [enabled, setEnabled] = useState(false);
  const [points, setPoints] = useState<DemandPoint[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "stale" | "error">("connecting");
  const [lastSnapshotAt, setLastSnapshotAt] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const lastSnapshotAtMsRef = useRef<number | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const disconnectRef = useRef<(() => void) | null>(null);

  const adapterStatusQuery = useQuery({
    queryFn: () => trpcClient.dashboard.adapterStatuses.query(),
    queryKey: ["adapter-statuses"],
    refetchInterval: 30_000,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const clearRetryTimer = () => {
      if (retryTimer.current) {
        clearTimeout(retryTimer.current);
        retryTimer.current = null;
      }
    };

    const connect = () => {
      clearRetryTimer();
      setStatus("connecting");

      const subscription = trpcClient.dashboard.eirgridDemand.subscribe(
        { replay: 24 },
        {
          onData: (snapshot) => {
            setStatus("live");
            setRetryCount(0);
            const timestamp = snapshot.effectiveTime ?? snapshot.capturedAt;
            setLastSnapshotAt(timestamp);
            lastSnapshotAtMsRef.current = new Date(timestamp).getTime();
            setPoints((existing) => {
              const next = [
                ...existing,
                {
                  demandMw: snapshot.demandMw,
                  time: snapshot.effectiveTime ?? snapshot.capturedAt,
                },
              ];
              return next.slice(-60);
            });
          },
          onError: () => {
            setStatus("error");
            setRetryCount((count) => {
              const nextCount = count + 1;
              const backoffMs = Math.min(nextCount * 2_000, 30_000);
              retryTimer.current = setTimeout(connect, backoffMs);
              return nextCount;
            });
          },
        },
      );

      disconnectRef.current = () => subscription.unsubscribe();
    };

    connect();

    staleTimer.current = setInterval(() => {
      const lastSnapshotAtMs = lastSnapshotAtMsRef.current;
      if (!lastSnapshotAtMs) {
        return;
      }
      if (Date.now() - lastSnapshotAtMs > 5 * 60_000) {
        setStatus((existing) => (existing === "live" ? "stale" : existing));
      }
    }, 15_000);

    return () => {
      clearRetryTimer();
      if (staleTimer.current) {
        clearInterval(staleTimer.current);
        staleTimer.current = null;
      }
      disconnectRef.current?.();
      disconnectRef.current = null;
    };
  }, [enabled]);

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

  if (!enabled) {
    return (
      <div className="mt-6 rounded-xl border bg-card/60 p-5 backdrop-blur">
        <div className="space-y-2">
          <h2 className="text-lg font-bold tracking-tight">EirGrid Demand Stream (SSE)</h2>
          <p className="text-xs font-medium text-muted-foreground">
            Enable the live demand stream to start subscription updates.
          </p>
          <button
            className="btn-glow rounded-lg border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
            onClick={() => setEnabled(true)}
            type="button"
          >
            Start stream
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-xl border bg-card/60 p-5 backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-lg font-bold tracking-tight">EirGrid Demand Stream (SSE)</h2>
        <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          {status === "live" && (
            <span className="live-dot" />
          )}
          Status: {status}
          {retryCount > 0 ? ` (retry ${retryCount})` : ""}
        </p>
      </div>
      <AreaChart
        categories={["Demand"]}
        className="h-56"
        data={chartData}
        index="Time"
        noDataText="Waiting for stream data"
      />

      <div className="mt-4 border-t border-border/60 pt-3">
        <p className="text-xs font-medium text-muted-foreground">
          Adapter Health:{" "}
          {adapterStatusQuery.data
            ? `${adapterStatusQuery.data.filter((item) => item.state !== "degraded").length}/${adapterStatusQuery.data.length} healthy`
            : "loading"}
        </p>
        <p className="mt-1 text-xs font-medium text-muted-foreground">
          Last snapshot:{" "}
          {lastSnapshotAt
            ? new Date(lastSnapshotAt).toLocaleTimeString("en-IE", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })
            : "waiting"}
        </p>
      </div>
    </div>
  );
}
