export type EirgridDemandSnapshot = {
  capturedAt: string;
  sourceUpdatedAt: string | null;
  effectiveTime: string | null;
  demandMw: number;
  region: "ALL";
  fieldName: string;
};

export type EirgridScalarSnapshot = {
  area: "demandactual" | "generationactual" | "windactual" | "frequency" | "co2intensity";
  capturedAt: string;
  sourceUpdatedAt: string | null;
  effectiveTime: string | null;
  fieldName: string | null;
  region: "ALL" | "ROI" | "NI";
  value: number;
};

export type EirgridInterconnectionSnapshot = {
  capturedAt: string;
  sourceUpdatedAt: string | null;
  effectiveTime: string | null;
  ewicMw: number | null;
  moyleMw: number | null;
};
