import { EventEmitter, on } from "node:events";

import type { EirgridDemandSnapshot } from "@/server/api/types";

const TOPIC = "eirgrid:demand";
const MAX_HISTORY = 288;

export class EirgridDemandChannel {
  private readonly emitter = new EventEmitter();
  private readonly history: EirgridDemandSnapshot[] = [];

  constructor() {
    // SSE fan-out can legitimately create >10 listeners in local/production usage.
    this.emitter.setMaxListeners(1_000);
  }

  publish(snapshot: EirgridDemandSnapshot) {
    this.history.push(snapshot);

    if (this.history.length > MAX_HISTORY) {
      this.history.shift();
    }

    this.emitter.emit(TOPIC, snapshot);
  }

  latest() {
    return this.history.at(-1) ?? null;
  }

  replay(limit = 24) {
    return this.history.slice(-Math.max(1, Math.min(limit, MAX_HISTORY)));
  }

  async *stream(signal?: AbortSignal) {
    for await (const [snapshot] of on(this.emitter, TOPIC, { signal })) {
      yield snapshot as EirgridDemandSnapshot;
    }
  }
}

export const eirgridDemandChannel = new EirgridDemandChannel();
