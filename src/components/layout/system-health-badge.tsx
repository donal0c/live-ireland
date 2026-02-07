"use client";

import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";

type ApiHealthResponse = {
  ok: boolean;
};

type ApiReadyResponse = {
  degraded: number;
  ok: boolean;
  total: number;
};

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export function SystemHealthBadge() {
  const healthQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/health`);
      if (!response.ok) {
        throw new Error("health endpoint unavailable");
      }
      return (await response.json()) as ApiHealthResponse;
    },
    queryKey: ["api-health", "liveness"],
    refetchInterval: 30_000,
  });

  const readyQuery = useQuery({
    queryFn: async () => {
      const response = await fetch(`${apiBase}/health/ready`);
      if (!response.ok) {
        throw new Error("readiness endpoint unavailable");
      }
      return (await response.json()) as ApiReadyResponse;
    },
    queryKey: ["api-health", "readiness"],
    refetchInterval: 30_000,
  });

  if (healthQuery.isLoading || readyQuery.isLoading) {
    return <Badge variant="outline">Checking API</Badge>;
  }

  if (healthQuery.isError || readyQuery.isError || !healthQuery.data?.ok) {
    return <Badge variant="destructive">API Offline</Badge>;
  }

  if (!readyQuery.data?.ok) {
    return (
      <Badge variant="outline">
        API Degraded ({readyQuery.data?.degraded ?? 0}/{readyQuery.data?.total ?? 0})
      </Badge>
    );
  }

  return <Badge variant="secondary">API Healthy</Badge>;
}
