import type { EirgridDemandSnapshot } from "@/server/api/types";

type EirgridRow = {
  EffectiveTime?: string;
  FieldName?: string;
  Region?: string;
  Value?: number;
};

type EirgridResponse = {
  Status?: string;
  LastUpdated?: string;
  Rows?: EirgridRow[];
};

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const toEirgridDate = (date: Date) => {
  const day = date.getDate().toString().padStart(2, "0");
  const month = monthNames[date.getMonth()];
  const year = date.getFullYear();
  return `${day}-${month}-${year}`;
};

const buildDemandUrl = (now: Date) => {
  const date = toEirgridDate(now);
  const query = new URLSearchParams({
    area: "demandactual",
    region: "ALL",
    datefrom: `${date} 00:00`,
    dateto: `${date} 23:59`,
  });

  return `https://www.smartgriddashboard.com/DashboardService.svc/data?${query.toString()}`;
};

const parseDemandRows = (rows: EirgridRow[]) => {
  const withValue = rows.filter((row) => typeof row.Value === "number");
  return withValue.at(-1) ?? null;
};

export const fetchLatestEirgridDemand = async (): Promise<EirgridDemandSnapshot> => {
  const now = new Date();
  const response = await fetch(buildDemandUrl(now), {
    headers: {
      accept: "application/json",
      "user-agent": "live-ireland-dashboard/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`EirGrid upstream failed: ${response.status}`);
  }

  const payload = (await response.json()) as EirgridResponse;
  const row = parseDemandRows(payload.Rows ?? []);

  if (!row || typeof row.Value !== "number") {
    throw new Error("EirGrid payload did not contain demand rows");
  }

  return {
    capturedAt: now.toISOString(),
    sourceUpdatedAt: payload.LastUpdated ?? null,
    effectiveTime: row.EffectiveTime ?? null,
    demandMw: row.Value,
    region: "ALL",
    fieldName: row.FieldName ?? "SYSTEM_DEMAND",
  };
};
