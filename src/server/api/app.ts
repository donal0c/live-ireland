import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";

import type { AdapterManager } from "@/server/adapters/runtime/adapter-manager";
import { getRuntimeConfig } from "@/server/config";
import { eirgridDemandChannel } from "@/server/realtime/eirgrid-channel";
import { appRouter } from "@/server/trpc/router";

const requestsPerMinute = new Map<string, { count: number; resetAt: number }>();
const metStationIdPattern = /^[a-z0-9-]+$/i;
const irishRailStationCodePattern = /^[a-z0-9]{3,8}$/i;
const luasStopCodePattern = /^[a-z]{3}$/i;

type RainViewerResponse = {
  host?: string;
  radar?: {
    past?: Array<{ path?: string }>;
  };
};

type DublinBikesInformationResponse = {
  data?: {
    stations?: Array<{
      capacity?: number;
      lat?: number;
      lon?: number;
      name?: string;
      station_id?: string;
    }>;
  };
};

type DublinBikesStatusResponse = {
  data?: {
    stations?: Array<{
      num_bikes_available?: number;
      num_docks_available?: number;
      station_id?: string;
    }>;
  };
};

type TiiSiteResponse = Array<{
  cosit?: string;
  location?: { lat?: number | null; lng?: number | null };
  name?: string;
}>;

type EsbOutageResponse = {
  outageMessage?: Array<{
    i?: string;
    p?: { c?: string };
    t?: string;
  }>;
};

const ESB_SUBSCRIPTION_KEY = "f713e48af3a746bbb1b110ab69113960";
const apiSecurityHeaders: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-permitted-cross-domain-policies": "none",
  "referrer-policy": "strict-origin-when-cross-origin",
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

const fetchTextOrThrow = async (url: string, signal?: AbortSignal): Promise<string> => {
  const response = await fetch(url, signal ? { signal } : undefined);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.text();
};

const xmlEntityMap: Record<string, string> = {
  "&amp;": "&",
  "&apos;": "'",
  "&gt;": ">",
  "&lt;": "<",
  "&quot;": '"',
};

const decodeXml = (value: string): string => {
  return value.replace(/&(amp|apos|gt|lt|quot);/g, (entity) => xmlEntityMap[entity] ?? entity);
};

const xmlBlocks = (xml: string, tagName: string): string[] => {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tagName}>`, "gi");
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? "");
};

const xmlValue = (block: string, tagName: string): string | null => {
  const match = block.match(new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i"));
  if (!match) {
    return null;
  }

  return decodeXml(match[1] ?? "").trim();
};

const xmlAttributes = (block: string, tagName: string): Array<Record<string, string>> => {
  const tagPattern = new RegExp(`<${tagName}\\s+([^>/]*?)\\s*\\/?>`, "gi");
  const attributePattern = /([a-zA-Z0-9_:-]+)="([^"]*)"/g;

  return [...block.matchAll(tagPattern)].map((match) => {
    const attributes: Record<string, string> = {};
    const payload = match[1] ?? "";
    for (const attributeMatch of payload.matchAll(attributePattern)) {
      const key = attributeMatch[1];
      const value = decodeXml(attributeMatch[2] ?? "");
      if (key) {
        attributes[key] = value;
      }
    }
    return attributes;
  });
};

export const createApiApp = (adapterManager: AdapterManager) => {
  const config = getRuntimeConfig();
  const app = new Hono();

  app.use("*", cors({ origin: config.corsOrigin }));
  app.use("*", async (c, next) => {
    const requestId = crypto.randomUUID();
    await next();
    c.header("x-request-id", requestId);
    for (const [key, value] of Object.entries(apiSecurityHeaders)) {
      c.header(key, value);
    }
  });
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
      uptimeSeconds: Math.round(process.uptime()),
    });
  });

  app.get("/health/ready", (c) => {
    const statuses = adapterManager.getStatuses();
    const degraded = statuses.filter((status) => status.state === "degraded").length;

    return c.json({
      degraded,
      ok: degraded === 0,
      total: statuses.length,
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

  app.get("/proxy/outages/esb", async (c) => {
    try {
      const esbResponse = await fetch("https://api.esb.ie/esbn/powercheck/v1.0/outages", {
        headers: {
          "API-Subscription-Key": ESB_SUBSCRIPTION_KEY,
        },
        signal: c.req.raw.signal,
      });
      if (!esbResponse.ok) {
        throw new Error(`Request failed ${esbResponse.status} for ESB outages`);
      }
      const response = (await esbResponse.json()) as EsbOutageResponse;

      const outages = (response.outageMessage ?? [])
        .map((outage) => {
          const [latRaw, lngRaw] = (outage.p?.c ?? ",").split(",");
          const lat = Number.parseFloat(latRaw ?? "");
          const lng = Number.parseFloat(lngRaw ?? "");
          return {
            id: outage.i ?? "unknown",
            lat,
            lng,
            type: outage.t ?? "Unknown",
          };
        })
        .filter((outage) => Number.isFinite(outage.lat) && Number.isFinite(outage.lng));

      return c.json({
        capturedAt: new Date().toISOString(),
        outages,
      });
    } catch (error) {
      console.error("[proxy] esb outages failed", error);
      return c.json({ error: "upstream_error" }, 502);
    }
  });

  app.get("/proxy/transport/overview", async (c) => {
    try {
      const [irishRailXml, dublinBikesInfo, dublinBikesStatus, tiiSites] = await Promise.all([
        fetchTextOrThrow(
          "https://api.irishrail.ie/realtime/realtime.asmx/getCurrentTrainsXML",
          c.req.raw.signal,
        ),
        fetchJsonOrThrow<DublinBikesInformationResponse>(
          "https://api.cyclocity.fr/contracts/dublin/gbfs/v2/station_information.json",
          c.req.raw.signal,
        ),
        fetchJsonOrThrow<DublinBikesStatusResponse>(
          "https://api.cyclocity.fr/contracts/dublin/gbfs/v2/station_status.json",
          c.req.raw.signal,
        ),
        fetchJsonOrThrow<TiiSiteResponse>(
          "https://data.tii.ie/Datasets/TrafficCountData/sites/tmu-sites.json",
          c.req.raw.signal,
        ),
      ]);

      const trains = xmlBlocks(irishRailXml, "objTrainPositions")
        .map((block) => {
          const lat = Number.parseFloat(xmlValue(block, "TrainLatitude") ?? "");
          const lng = Number.parseFloat(xmlValue(block, "TrainLongitude") ?? "");
          return {
            code: xmlValue(block, "TrainCode") ?? "UNKNOWN",
            direction: xmlValue(block, "Direction") ?? "Unknown",
            lat,
            lng,
            message: xmlValue(block, "PublicMessage") ?? "No public message",
            status: xmlValue(block, "TrainStatus") ?? "N",
          };
        })
        .filter((train) => Number.isFinite(train.lat) && Number.isFinite(train.lng))
        .filter((train) => Math.abs(train.lat) > 0.01 && Math.abs(train.lng) > 0.01);

      const statusById = new Map(
        (dublinBikesStatus.data?.stations ?? [])
          .filter((station) => station.station_id)
          .map((station) => [station.station_id as string, station]),
      );

      const dublinBikes = (dublinBikesInfo.data?.stations ?? [])
        .map((station) => {
          const status = statusById.get(station.station_id ?? "");
          const bikes = status?.num_bikes_available ?? 0;
          const docks = status?.num_docks_available ?? 0;
          const capacity = station.capacity ?? bikes + docks;
          const total = bikes + docks;
          const availability = total > 0 ? bikes / total : 0;
          return {
            id: station.station_id ?? "unknown",
            name: station.name ?? "Unknown station",
            lat: station.lat ?? 0,
            lng: station.lon ?? 0,
            bikes,
            docks,
            capacity,
            availability,
          };
        })
        .filter((station) => Number.isFinite(station.lat) && Number.isFinite(station.lng))
        .filter((station) => Math.abs(station.lat) > 0.01 && Math.abs(station.lng) > 0.01);

      const trafficSites = tiiSites
        .map((site) => ({
          cosit: site.cosit ?? "unknown",
          name: site.name ?? site.cosit ?? "Unknown site",
          lat: site.location?.lat ?? 0,
          lng: site.location?.lng ?? 0,
        }))
        .filter((site) => Number.isFinite(site.lat) && Number.isFinite(site.lng))
        .filter((site) => Math.abs(site.lat) > 0.01 && Math.abs(site.lng) > 0.01);

      return c.json({
        capturedAt: new Date().toISOString(),
        dublinBikes,
        trafficSites,
        trains,
      });
    } catch (error) {
      console.error("[proxy] transport overview failed", error);
      return c.json({ error: "upstream_error" }, 502);
    }
  });

  app.get("/proxy/transport/irish-rail/departures/:stationCode", async (c) => {
    const stationCode = c.req.param("stationCode");
    if (!irishRailStationCodePattern.test(stationCode)) {
      return c.json({ error: "invalid_station_code" }, 400);
    }

    try {
      const stationXml = await fetchTextOrThrow(
        `https://api.irishrail.ie/realtime/realtime.asmx/getStationDataByCodeXML?StationCode=${stationCode.toUpperCase()}`,
        c.req.raw.signal,
      );

      const departures = xmlBlocks(stationXml, "objStationData")
        .map((block) => {
          const dueInMins = Number.parseInt(xmlValue(block, "Duein") ?? "0", 10);
          const lateByMins = Number.parseInt(xmlValue(block, "Late") ?? "0", 10);
          return {
            code: xmlValue(block, "Traincode") ?? "UNKNOWN",
            destination: xmlValue(block, "Destination") ?? "Unknown",
            dueInMins: Number.isNaN(dueInMins) ? 0 : dueInMins,
            expectedArrival: xmlValue(block, "Exparrival") ?? "--:--",
            expectedDeparture: xmlValue(block, "Expdepart") ?? "--:--",
            lateByMins: Number.isNaN(lateByMins) ? 0 : lateByMins,
            origin: xmlValue(block, "Origin") ?? "Unknown",
            status: xmlValue(block, "Status") ?? "No Information",
            trainType: xmlValue(block, "Traintype") ?? "Train",
          };
        })
        .sort((a, b) => a.dueInMins - b.dueInMins);

      const stationName =
        xmlValue(xmlBlocks(stationXml, "objStationData")[0] ?? "", "Stationfullname") ??
        stationCode.toUpperCase();

      return c.json({
        departures,
        stationCode: stationCode.toUpperCase(),
        stationName,
      });
    } catch (error) {
      console.error("[proxy] irish rail departures failed", error);
      return c.json({ error: "upstream_error" }, 502);
    }
  });

  app.get("/proxy/transport/luas/forecast/:stopCode", async (c) => {
    const stopCode = c.req.param("stopCode");
    if (!luasStopCodePattern.test(stopCode)) {
      return c.json({ error: "invalid_stop_code" }, 400);
    }

    try {
      const forecastXml = await fetchTextOrThrow(
        `https://luasforecasts.rpa.ie/xml/get.ashx?action=forecast&stop=${stopCode.toUpperCase()}&encrypt=false`,
        c.req.raw.signal,
      );

      if (!forecastXml.includes("<stopInfo")) {
        return c.json({ error: "invalid_upstream_response" }, 502);
      }

      const stopInfo = forecastXml.match(/<stopInfo([^>]*)>/i)?.[1] ?? "";
      const stopAttributes = xmlAttributes(`<stopInfo ${stopInfo} />`, "stopInfo")[0] ?? {};
      const message = xmlValue(forecastXml, "message") ?? "No message";

      const directionPattern = /<direction([^>]*)>([\s\S]*?)<\/direction>/gi;
      const directions = [...forecastXml.matchAll(directionPattern)].map((directionMatch) => {
        const directionAttributes =
          xmlAttributes(`<direction ${directionMatch[1] ?? ""} />`, "direction")[0] ?? {};
        const directionBody = directionMatch[2] ?? "";

        return {
          name: directionAttributes.name ?? "Unknown",
          trams: xmlAttributes(directionBody, "tram")
            .map((tram) => ({
              destination: tram.destination ?? "Unknown",
              dueMins: tram.dueMins ?? "",
            }))
            .filter((tram) => {
              const destination = tram.destination.toLowerCase();
              return destination !== "no trams forecast" && destination !== "no northbound service";
            }),
        };
      });

      return c.json({
        created: stopAttributes.created ?? null,
        directions,
        message,
        stop: stopAttributes.stop ?? stopCode.toUpperCase(),
        stopAbv: stopAttributes.stopAbv ?? stopCode.toUpperCase(),
      });
    } catch (error) {
      console.error("[proxy] luas forecast failed", error);
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
