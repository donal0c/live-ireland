import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AdapterManager } from "@/server/adapters/runtime/adapter-manager";
import { getRuntimeConfig } from "@/server/config";
import { eirgridDemandChannel } from "@/server/realtime/eirgrid-channel";
import { appRouter } from "@/server/trpc/router";

const requestsPerMinute = new Map<string, { count: number; resetAt: number }>();
const metStationIdPattern = /^[a-z0-9-]+$/i;

type RainViewerResponse = {
  host?: string;
  radar?: {
    past?: Array<{ path?: string }>;
  };
};

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

const fetchJsonOrThrow = async <T>(url: string, signal?: AbortSignal): Promise<T> => {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
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

  app.get("/proxy/met/observations/:station", async (c) => {
    const station = c.req.param("station");
    if (!metStationIdPattern.test(station)) {
      return c.json({ error: "invalid_station" }, 400);
    }

    try {
      const data = await fetchJsonOrThrow<unknown[]>(
        `https://prodapi.metweb.ie/observations/${station}/today`,
        c.req.raw.signal,
      );
      return c.json(data);
    } catch (error) {
      console.error("[proxy] met observations failed", error);
      return c.json({ error: "upstream_error" }, 502);
    }
  });

  app.get("/proxy/weather/map-layers", async (c) => {
    try {
      const [opwRaw, warningsRaw, epaRaw, radarRaw] = await Promise.all([
        fetchJsonOrThrow<unknown>("https://waterlevel.ie/geojson/latest/", c.req.raw.signal),
        fetchJsonOrThrow<unknown>("https://prodapi.metweb.ie/warnings/active", c.req.raw.signal),
        fetchJsonOrThrow<unknown>(
          "https://gis.epa.ie/geoserver/EPA/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=EPA:AIR_MonitoringSites&outputFormat=application/json",
          c.req.raw.signal,
        ),
        fetchJsonOrThrow<RainViewerResponse>(
          "https://api.rainviewer.com/public/weather-maps.json",
          c.req.raw.signal,
        ),
      ]);

      const radarPath = radarRaw.radar?.past?.at(-1)?.path;
      const host = radarRaw.host;
      const radarTileUrl =
        host && radarPath ? `${host}${radarPath}/256/{z}/{x}/{y}/2/1_1.png` : null;

      return c.json({
        epa: epaRaw,
        opw: opwRaw,
        radarTileUrl,
        warnings: warningsRaw,
      });
    } catch (error) {
      console.error("[proxy] weather map layers failed", error);
      return c.json({ error: "upstream_error" }, 502);
    }
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
