import { serve } from "@hono/node-server";

import { createApiApp } from "@/server/api/app";
import { ValkeyCache } from "@/server/cache/valkey";
import { getRuntimeConfig } from "@/server/config";
import { startEirgridPoller } from "@/server/realtime/eirgrid-poller";

const config = getRuntimeConfig();
const cache = new ValkeyCache(config.upstashUrl, config.upstashToken);

const stopPoller = startEirgridPoller({
  cache,
  intervalMs: config.eirgridPollIntervalMs,
});

const app = createApiApp();

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`[api] listening on :${config.port}`);
console.log(`[api] valkey enabled: ${cache.enabled ? "yes" : "no"}`);

const shutdown = () => {
  stopPoller();
  server.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
