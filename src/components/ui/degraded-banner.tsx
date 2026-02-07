import { Badge } from "@/components/ui/badge";

export function DegradedBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 dark:border-amber-700 dark:bg-amber-950/40">
      <div className="flex items-center gap-2">
        <Badge variant="outline">Degraded</Badge>
        <p className="text-sm text-amber-900 dark:text-amber-100">{message}</p>
      </div>
    </div>
  );
}
