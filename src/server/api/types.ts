export type EirgridDemandSnapshot = {
  capturedAt: string;
  sourceUpdatedAt: string | null;
  effectiveTime: string | null;
  demandMw: number;
  region: "ALL";
  fieldName: string;
};
