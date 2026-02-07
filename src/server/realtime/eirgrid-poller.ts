import type { ValkeyCache } from "@/server/cache/valkey";
import { fetchLatestEirgridDemand } from "@/server/data/eirgrid";
import { type EirgridDemandChannel, eirgridDemandChannel } from "@/server/realtime/eirgrid-channel";

type PollerDeps = {
  channel?: EirgridDemandChannel;
  cache?: ValkeyCache;
  intervalMs: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const startEirgridPoller = ({
  channel = eirgridDemandChannel,
  cache,
  intervalMs,
}: PollerDeps) => {
  let running = true;

  const tick = async () => {
    try {
      const snapshot = await fetchLatestEirgridDemand();
      channel.publish(snapshot);
      await cache?.cacheDemandSnapshot(snapshot);
      await cache?.publishDemandSnapshot(snapshot);
    } catch (error) {
      console.error("[poller] EirGrid demand fetch failed", error);
    }
  };

  const loop = async () => {
    while (running) {
      await tick();
      await sleep(intervalMs);
    }
  };

  void loop();

  return () => {
    running = false;
  };
};
