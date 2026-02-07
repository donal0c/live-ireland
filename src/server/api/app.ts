import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AdapterManager } from "@/server/adapters/runtime/adapter-manager";
import { getRuntimeConfig } from "@/server/config";
import { eirgridDemandChannel } from "@/server/realtime/eirgrid-channel";
import { appRouter } from "@/server/trpc/router";

const requestsPerMinute = new Map<string, { count: number; resetAt: number }>();

const getClientIp = (value: string | undefined) => {
  if (!value) {
    return "unknown";
  }

  return value.split(",")[0]?.trim() ?? "unknown";
};

const rateLimit = (maxPerMinute: number) => {
  return async (c: Parameters<Parameters<Hono["use"]>[1]>[0], next: () => Promise<void>) => {
    const now = Date.now();
    const key = getClientIp(c.req.header("x-forwarded-for"));
    const existing = requestsPerMinute.get(key);

    if (!existing || existing.resetAt <= now) {
      requestsPerMinute.set(key, { count: 1, resetAt: now + 60_000 });
      await next();
      return;
    }

    if (existing.count >= maxPerMinute) {
      return c.json({ error: "rate_limit_exceeded" }, 429);
    }

    existing.count += 1;
    await next();
  };
};

export const createApiApp = (adapterManager: AdapterManager) => {
  const config = getRuntimeConfig();
  const app = new Hono();

  app.use("*", cors({ origin: config.corsOrigin }));
  app.use("*", rateLimit(240));

  app.onError((error, c) => {
    console.error("[api] uncaught error", error);
    return c.json({ error: "internal_error", message: error.message }, 500);
  });

  app.get("/health", (c) => {
    return c.json({
      adapterCount: adapterManager.getStatuses().length,
      now: new Date().toISOString(),
      ok: true,
    });
  });

  app.get("/metrics", (c) => {
    const activeIps = requestsPerMinute.size;
    return c.text(`live_ireland_active_ip_count ${activeIps}\n`);
  });

  app.get("/adapters/health", (c) => {
    return c.json({
      adapters: adapterManager.getStatuses(),
    });
  });

  app.use(
    "/trpc/*",
    trpcServer({
      router: appRouter,
      endpoint: "/trpc",
      createContext: () => ({
        adapterManager,
        channel: eirgridDemandChannel,
      }),
      onError: ({ error, path }) => {
        console.error("[trpc]", path, error);
      },
    }),
  );

  return app;
};
