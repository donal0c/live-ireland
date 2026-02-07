export type AdapterRunState = "idle" | "running" | "degraded";

export type AdapterStatus = {
  id: string;
  title: string;
  state: AdapterRunState;
  pollIntervalMs: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  nextRunAt: string | null;
  consecutiveFailures: number;
  totalFailures: number;
  totalSuccesses: number;
  lastError: string | null;
};

export type AdapterEnvelope<TPayload> = {
  adapterId: string;
  capturedAt: string;
  payload: TPayload;
  recordCount: number;
  summary: string;
};

export type AdapterPollContext = {
  signal: AbortSignal;
};

export interface Adapter<TPayload> {
  readonly id: string;
  readonly title: string;
  readonly pollIntervalMs: number;
  readonly minimumDelayMs: number;
  status(): AdapterStatus;
  latest(): AdapterEnvelope<TPayload> | null;
  poll(context: AdapterPollContext): Promise<AdapterEnvelope<TPayload>>;
  noteSuccess(ranAt: Date): void;
  noteFailure(ranAt: Date, error: unknown): void;
  noteScheduledNextRun(nextRunAt: Date): void;
}
