import type { Adapter, AdapterEnvelope, AdapterStatus } from "@/server/adapters/core/types";
import type { ValkeyCache } from "@/server/cache/valkey";
import type { AdapterDataStore } from "@/server/store/adapter-data-store";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type AdapterManagerOptions = {
  adapters: Adapter<unknown>[];
  cache?: ValkeyCache;
  dataStore?: AdapterDataStore;
  retries?: number;
};

const withAbortTimeout = async <T>(
  timeoutMs: number,
  callback: (signal: AbortSignal) => Promise<T>,
): Promise<T> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
  }
};

export class AdapterManager {
  private readonly adapters: Adapter<unknown>[];
  private readonly cache: ValkeyCache | undefined;
  private readonly dataStore: AdapterDataStore | undefined;
  private readonly retries: number;

  constructor(options: AdapterManagerOptions) {
    this.adapters = options.adapters;
    this.cache = options.cache;
    this.dataStore = options.dataStore;
    this.retries = options.retries ?? 2;
  }

  getStatuses(): AdapterStatus[] {
    return this.adapters.map((adapter) => adapter.status());
  }

  getLatest(adapterId: string) {
    const adapter = this.adapters.find((item) => item.id === adapterId);
    return adapter?.latest() ?? null;
  }

  start() {
    let running = true;
    const stops = this.adapters.map((adapter) => this.startAdapterLoop(adapter, () => running));

    return () => {
      running = false;
      for (const stop of stops) {
        stop();
      }
    };
  }

  private startAdapterLoop(adapter: Adapter<unknown>, shouldRun: () => boolean) {
    let active = true;

    const runOne = async () => {
      const startedAt = new Date();

      for (let attempt = 0; attempt <= this.retries; attempt += 1) {
        try {
          const envelope = await withAbortTimeout(20_000, (signal) => adapter.poll({ signal }));
          adapter.noteSuccess(startedAt);
          await this.afterSuccess(adapter.id, envelope);
          return;
        } catch (error) {
          if (attempt >= this.retries) {
            adapter.noteFailure(startedAt, error);
            return;
          }

          await sleep(1_000 * (attempt + 1));
        }
      }
    };

    const loop = async () => {
      while (active && shouldRun()) {
        await runOne();

        const next = new Date(Date.now() + adapter.pollIntervalMs);
        adapter.noteScheduledNextRun(next);

        await sleep(Math.max(adapter.pollIntervalMs, adapter.minimumDelayMs));
      }
    };

    void loop();

    return () => {
      active = false;
    };
  }

  private async afterSuccess(adapterId: string, envelope: AdapterEnvelope<unknown>) {
    await this.cache?.cacheAdapterSnapshot(adapterId, envelope);
    await this.cache?.publishAdapterSnapshot(adapterId, envelope);
    await this.dataStore?.storeAdapterSnapshot(adapterId, envelope);
  }
}
