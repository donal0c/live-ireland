"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function DashboardRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="space-y-3">
      <h2 className="text-xl font-semibold">Unable to load this dashboard tab.</h2>
      <p className="text-sm text-muted-foreground">
        An unexpected rendering error occurred in this route segment.
      </p>
      <Button onClick={reset} type="button" variant="outline">
        Retry
      </Button>
    </div>
  );
}
