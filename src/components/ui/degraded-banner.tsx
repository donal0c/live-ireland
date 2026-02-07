import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export function DegradedBanner({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-amber-400/40 bg-amber-50/80 p-4 backdrop-blur dark:border-amber-500/20 dark:bg-amber-950/30">
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        <Badge variant="outline" className="text-[11px] font-semibold uppercase tracking-wider">
          Degraded
        </Badge>
        <p className="text-sm text-amber-800 dark:text-amber-200">{message}</p>
      </div>
    </div>
  );
}
