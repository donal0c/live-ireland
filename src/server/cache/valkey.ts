import { Redis } from "@upstash/redis";

import type { EirgridDemandSnapshot } from "@/server/api/types";

export class ValkeyCache {
  private readonly redis: Redis | null;

  constructor(url?: string, token?: string) {
    this.redis = url && token ? new Redis({ url, token }) : null;
  }

  get enabled() {
    return this.redis !== null;
  }

  async cacheDemandSnapshot(snapshot: EirgridDemandSnapshot) {
    if (!this.redis) {
      return;
    }

    await this.redis.set("latest:eirgrid:demand", snapshot, { ex: 60 * 15 });
  }

  async publishDemandSnapshot(snapshot: EirgridDemandSnapshot) {
    if (!this.redis) {
      return;
    }

    await this.redis.publish("eirgrid:demand", JSON.stringify(snapshot));
  }
}
