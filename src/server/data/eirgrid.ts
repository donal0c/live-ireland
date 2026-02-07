import type {
  EirgridDemandSnapshot,
  EirgridInterconnectionSnapshot,
  EirgridScalarSnapshot,
} from "@/server/api/types";

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

type EirgridArea =
  | "demandactual"
  | "generationactual"
  | "windactual"
  | "frequency"
  | "co2intensity"
  | "interconnection";

type EirgridFetchOptions = {
  area: EirgridArea;
  region?: "ALL" | "ROI" | "NI";
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

const buildAreaUrl = (now: Date, options: EirgridFetchOptions) => {
  const date = toEirgridDate(now);
  const query = new URLSearchParams({
    area: options.area,
    region: options.region ?? "ALL",
    datefrom: `${date} 00:00`,
    dateto: `${date} 23:59`,
  });

  return `https://www.smartgriddashboard.com/DashboardService.svc/data?${query.toString()}`;
};

const fetchAreaRows = async (options: EirgridFetchOptions) => {
  const now = new Date();
  const response = await fetch(buildAreaUrl(now, options), {
    headers: {
      accept: "application/json",
      "user-agent": "live-ireland-dashboard/0.1",
    },
  });

  if (!response.ok) {
    throw new Error(`EirGrid upstream failed: ${response.status} (${options.area})`);
  }

  const payload = (await response.json()) as EirgridResponse;
  const rows = (payload.Rows ?? []).filter((row) => typeof row.Value === "number");

  return {
    capturedAt: now.toISOString(),
    rows,
    sourceUpdatedAt: payload.LastUpdated ?? null,
  };
};

const latestRow = (rows: EirgridRow[]) => rows.at(-1) ?? null;

export const fetchLatestEirgridDemand = async (): Promise<EirgridDemandSnapshot> => {
  const { capturedAt, rows, sourceUpdatedAt } = await fetchAreaRows({
    area: "demandactual",
    region: "ALL",
  });

  const row = latestRow(rows);
  if (!row || typeof row.Value !== "number") {
    throw new Error("EirGrid demand payload did not contain rows");
  }

  return {
    capturedAt,
    sourceUpdatedAt,
    effectiveTime: row.EffectiveTime ?? null,
    demandMw: row.Value,
    region: "ALL",
    fieldName: row.FieldName ?? "SYSTEM_DEMAND",
  };
};

export const fetchLatestEirgridScalar = async (
  area: Exclude<EirgridArea, "interconnection" | "demandactual">,
  options?: Pick<EirgridFetchOptions, "region">,
): Promise<EirgridScalarSnapshot> => {
  const request: EirgridFetchOptions = { area };
  if (options?.region) {
    request.region = options.region;
  }

  const { capturedAt, rows, sourceUpdatedAt } = await fetchAreaRows(request);

  const row = latestRow(rows);

  if (!row || typeof row.Value !== "number") {
    throw new Error(`EirGrid ${area} payload did not contain rows`);
  }

  return {
    area,
    capturedAt,
    effectiveTime: row.EffectiveTime ?? null,
    fieldName: row.FieldName ?? null,
    region: (row.Region as "ALL" | "ROI" | "NI" | undefined) ?? options?.region ?? "ALL",
    sourceUpdatedAt,
    value: row.Value,
  };
};

export const fetchLatestEirgridInterconnection =
  async (): Promise<EirgridInterconnectionSnapshot> => {
    const { capturedAt, rows, sourceUpdatedAt } = await fetchAreaRows({
      area: "interconnection",
      region: "ALL",
    });

    if (rows.length === 0) {
      throw new Error("EirGrid interconnection payload did not contain rows");
    }

    const latestTime = rows.at(-1)?.EffectiveTime ?? null;
    const sameTimestampRows = latestTime
      ? rows.filter((row) => row.EffectiveTime === latestTime)
      : rows.slice(-2);

    const byField = new Map(
      sameTimestampRows
        .filter((row) => row.FieldName && typeof row.Value === "number")
        .map((row) => [row.FieldName as string, row.Value as number]),
    );

    return {
      capturedAt,
      effectiveTime: latestTime,
      ewicMw: byField.get("INTER_EWIC") ?? null,
      moyleMw: byField.get("INTER_MOYLE") ?? null,
      sourceUpdatedAt,
    };
  };
