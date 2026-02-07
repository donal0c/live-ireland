import type { AdapterEnvelope } from "@/server/adapters/core/types";
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
      const envelope: AdapterEnvelope<typeof snapshot> = {
        adapterId: "eirgrid-demand",
        capturedAt: new Date().toISOString(),
        payload: snapshot,
        recordCount: 1,
        summary: `Demand ${snapshot.demandMw} MW`,
      };
      channel.publish(snapshot);
      await cache?.cacheAdapterSnapshot("eirgrid-demand", envelope);
      await cache?.publishAdapterSnapshot("eirgrid-demand", envelope);
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
