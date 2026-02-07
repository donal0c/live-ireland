import type {
  Adapter,
  AdapterEnvelope,
  AdapterPollContext,
  AdapterStatus,
} from "@/server/adapters/core/types";

type AdapterConfig = {
  id: string;
  title: string;
  pollIntervalMs: number;
  minimumDelayMs?: number;
};

export abstract class BaseAdapter<TPayload> implements Adapter<TPayload> {
  readonly id: string;
  readonly title: string;
  readonly pollIntervalMs: number;
  readonly minimumDelayMs: number;

  private readonly adapterStatus: AdapterStatus;
  private lastPayload: AdapterEnvelope<TPayload> | null = null;

  protected constructor(config: AdapterConfig) {
    this.id = config.id;
    this.title = config.title;
    this.pollIntervalMs = config.pollIntervalMs;
    this.minimumDelayMs = config.minimumDelayMs ?? 0;

    this.adapterStatus = {
      id: config.id,
      title: config.title,
      state: "idle",
      pollIntervalMs: config.pollIntervalMs,
      lastRunAt: null,
      lastSuccessAt: null,
      nextRunAt: null,
      consecutiveFailures: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      lastError: null,
    };
  }

  latest() {
    return this.lastPayload;
  }

  status() {
    return { ...this.adapterStatus };
  }

  async poll(context: AdapterPollContext) {
    this.adapterStatus.state = "running";
    const result = await this.fetch(context);
    this.lastPayload = result;
    return result;
  }

  noteSuccess(ranAt: Date) {
    this.adapterStatus.lastRunAt = ranAt.toISOString();
    this.adapterStatus.lastSuccessAt = ranAt.toISOString();
    this.adapterStatus.totalSuccesses += 1;
    this.adapterStatus.consecutiveFailures = 0;
    this.adapterStatus.lastError = null;
    this.adapterStatus.state = "idle";
  }

  noteFailure(ranAt: Date, error: unknown) {
    this.adapterStatus.lastRunAt = ranAt.toISOString();
    this.adapterStatus.totalFailures += 1;
    this.adapterStatus.consecutiveFailures += 1;
    this.adapterStatus.lastError = error instanceof Error ? error.message : String(error);
    this.adapterStatus.state = "degraded";
  }

  noteScheduledNextRun(nextRunAt: Date) {
    this.adapterStatus.nextRunAt = nextRunAt.toISOString();
  }

  protected abstract fetch(context: AdapterPollContext): Promise<AdapterEnvelope<TPayload>>;
}
