export type ApiRuntimeConfig = {
  port: number;
  corsOrigin: string;
  eirgridPollIntervalMs: number;
  upstashUrl?: string;
  upstashToken?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
};

const getNumber = (value: string | undefined, fallback: number) => {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const getRuntimeConfig = (): ApiRuntimeConfig => {
  const config: ApiRuntimeConfig = {
    port: getNumber(process.env.API_PORT, 8787),
    corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:3000",
    eirgridPollIntervalMs: getNumber(process.env.EIRGRID_POLL_INTERVAL_MS, 30_000),
  };

  if (process.env.UPSTASH_REDIS_REST_URL) {
    config.upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  }

  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    config.upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  if (process.env.SUPABASE_URL) {
    config.supabaseUrl = process.env.SUPABASE_URL;
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  return config;
};
