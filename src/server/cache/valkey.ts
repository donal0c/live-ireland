import { Redis as UpstashRedis } from "@upstash/redis";
import { createClient, type RedisClientType } from "redis";

import type { AdapterEnvelope } from "@/server/adapters/core/types";

export class ValkeyCache {
  private readonly upstash: UpstashRedis | null;
  private readonly localRedis: RedisClientType | null;

  constructor(options?: { upstashUrl?: string; upstashToken?: string; redisUrl?: string }) {
    this.upstash =
      options?.upstashUrl && options?.upstashToken
        ? new UpstashRedis({
            token: options.upstashToken,
            url: options.upstashUrl,
          })
        : null;

    this.localRedis = options?.redisUrl
      ? createClient({
          url: options.redisUrl,
        })
      : null;

    if (this.localRedis) {
      this.localRedis.connect().catch((error) => {
        console.error("[cache] local redis connect failed", error);
      });
    }
  }

  get enabled() {
    return this.upstash !== null || this.localRedis !== null;
  }

  private async setValue(key: string, value: string, ttlSeconds: number) {
    if (this.upstash) {
      await this.upstash.set(key, value, { ex: ttlSeconds });
    }

    if (this.localRedis?.isOpen) {
      await this.localRedis.set(key, value, { EX: ttlSeconds });
    }
  }

  private async publish(channel: string, value: string) {
    if (this.upstash) {
      await this.upstash.publish(channel, value);
    }

    if (this.localRedis?.isOpen) {
      await this.localRedis.publish(channel, value);
    }
  }

  async cacheAdapterSnapshot(adapterId: string, snapshot: AdapterEnvelope<unknown>) {
    const serialized = JSON.stringify(snapshot);
    await this.setValue(`latest:${adapterId}`, serialized, 60 * 15);
  }

  async publishAdapterSnapshot(adapterId: string, snapshot: AdapterEnvelope<unknown>) {
    const serialized = JSON.stringify(snapshot);
    await this.publish(`adapter:${adapterId}`, serialized);
  }

  async close() {
    if (this.localRedis?.isOpen) {
      await this.localRedis.quit();
    }
  }
}
