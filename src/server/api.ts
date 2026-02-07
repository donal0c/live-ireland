import { serve } from "@hono/node-server";
import { AdapterManager } from "@/server/adapters/runtime/adapter-manager";
import { createAdapterRegistry } from "@/server/adapters/runtime/registry";
import { createApiApp } from "@/server/api/app";
import { ValkeyCache } from "@/server/cache/valkey";
import { getRuntimeConfig } from "@/server/config";
import { createSupabaseAdminClient } from "@/server/db/supabase";
import { AdapterDataStore } from "@/server/store/adapter-data-store";

const config = getRuntimeConfig();
const cacheOptions: { upstashUrl?: string; upstashToken?: string; redisUrl?: string } = {};

if (config.redisUrl) {
  cacheOptions.redisUrl = config.redisUrl;
}

if (config.upstashUrl) {
  cacheOptions.upstashUrl = config.upstashUrl;
}

if (config.upstashToken) {
  cacheOptions.upstashToken = config.upstashToken;
}

const cache = new ValkeyCache(cacheOptions);
const supabase = createSupabaseAdminClient(config.supabaseUrl, config.supabaseServiceRoleKey);
const dataStore = new AdapterDataStore(supabase);
const adapterManager = new AdapterManager({
  adapters: createAdapterRegistry(config.eirgridPollIntervalMs),
  cache,
  dataStore,
});

const stopAdapters = adapterManager.start();

const app = createApiApp(adapterManager);

const server = serve({
  fetch: app.fetch,
  port: config.port,
});

console.log(`[api] listening on :${config.port}`);
console.log(`[api] valkey enabled: ${cache.enabled ? "yes" : "no"}`);
console.log(`[api] supabase enabled: ${dataStore.enabled ? "yes" : "no"}`);

const shutdown = () => {
  stopAdapters();
  void cache.close();
  server.close();
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
