"use client";

import { useQuery } from "@tanstack/react-query";
import type React from "react";

import { trpcClient } from "@/lib/trpc-client";
import { cn } from "@/lib/utils";

export type AdapterEnvelope<T> = {
  adapterId: string;
  capturedAt: string;
  payload: T;
  recordCount: number;
  summary: string;
};

export function useAdapterSnapshot<T>(adapterId: string, refetchInterval = 30_000) {
  return useQuery({
    queryFn: async () => {
      const result = await trpcClient.dashboard.latestAdapterSnapshot.query({ adapterId });
      return result as AdapterEnvelope<T> | null;
    },
    queryKey: ["adapter-snapshot", adapterId],
    refetchInterval,
  });
}

export const formatFreshness = (capturedAt: string | null | undefined) => {
  if (!capturedAt) {
    return "No snapshot yet";
  }

  const capturedTime = new Date(capturedAt).getTime();
  if (!Number.isFinite(capturedTime)) {
    return "Snapshot time unavailable";
  }

  const ageSeconds = Math.max(0, Math.round((Date.now() - capturedTime) / 1000));
  if (ageSeconds < 60) {
    return `Updated ${ageSeconds}s ago`;
  }

  const ageMinutes = Math.round(ageSeconds / 60);
  if (ageMinutes < 60) {
    return `Updated ${ageMinutes}m ago`;
  }

  const ageHours = Math.round(ageMinutes / 60);
  return `Updated ${ageHours}h ago`;
};

export function KpiCard({
  icon: Icon,
  label,
  value,
  unit,
  subtext,
  capturedAt,
  accentColor,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  unit?: string | undefined;
  subtext?: string | undefined;
  capturedAt?: string | null | undefined;
  accentColor?: string | undefined;
}) {
  return (
    <div className="kpi-card group rounded-xl border bg-card/80 p-4 backdrop-blur transition-all duration-200 hover:bg-card/95 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <div
          className="flex h-8 w-8 items-center justify-center rounded-lg opacity-60 transition-opacity group-hover:opacity-100"
          style={{ backgroundColor: `${accentColor ?? "var(--kpi-accent)"}15` }}
        >
          <Icon className="h-4 w-4" style={{ color: accentColor ?? "var(--kpi-accent)" }} />
        </div>
      </div>
      <div className="mt-2 metric-value">
        <span className="text-2xl font-bold tabular-nums tracking-tight">{value}</span>
        {unit ? (
          <span className="ml-1 text-sm font-medium text-muted-foreground">{unit}</span>
        ) : null}
      </div>
      {subtext ? <p className="mt-1 text-[11px] text-muted-foreground">{subtext}</p> : null}
      {capturedAt !== undefined ? (
        <p className="mt-2 text-[11px] font-medium text-muted-foreground">
          {formatFreshness(capturedAt)}
        </p>
      ) : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string | undefined;
}) {
  return (
    <div
      className={cn(
        "flex min-h-32 flex-col items-start justify-center rounded-xl border border-dashed bg-card/50 p-4",
        className,
      )}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

export function MapStatusOverlay({
  title,
  description,
  visible,
}: {
  title: string;
  description: string;
  visible: boolean;
}) {
  if (!visible) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-3 flex items-center justify-center rounded-lg border border-dashed bg-card/85 p-4 text-center shadow-sm backdrop-blur">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
