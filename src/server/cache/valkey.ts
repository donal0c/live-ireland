import { Redis } from "@upstash/redis";

import type { AdapterEnvelope } from "@/server/adapters/core/types";

export class ValkeyCache {
  private readonly redis: Redis | null;

  constructor(url?: string, token?: string) {
    this.redis = url && token ? new Redis({ url, token }) : null;
  }

  get enabled() {
    return this.redis !== null;
  }

  async cacheAdapterSnapshot(adapterId: string, snapshot: AdapterEnvelope<unknown>) {
    if (!this.redis) {
      return;
    }

    await this.redis.set(`latest:${adapterId}`, snapshot, { ex: 60 * 15 });
  }

  async publishAdapterSnapshot(adapterId: string, snapshot: AdapterEnvelope<unknown>) {
    if (!this.redis) {
      return;
    }

    await this.redis.publish(`adapter:${adapterId}`, JSON.stringify(snapshot));
  }
}
