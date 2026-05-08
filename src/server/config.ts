export type ApiRuntimeConfig = {
  port: number;
  corsOrigin: string;
  eirgridPollIntervalMs: number;
  esbSubscriptionKey: string;
  upstashUrl?: string;
  upstashToken?: string;
  redisUrl?: string;
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
};

const defaultEsbSubscriptionKey = "f713e48af3a746bbb1b110ab69113960";

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
    esbSubscriptionKey: process.env.ESB_SUBSCRIPTION_KEY || defaultEsbSubscriptionKey,
  };

  if (process.env.UPSTASH_REDIS_REST_URL) {
    config.upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
  }

  if (process.env.UPSTASH_REDIS_REST_TOKEN) {
    config.upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  }

  if (process.env.REDIS_URL) {
    config.redisUrl = process.env.REDIS_URL;
  }

  if (process.env.SUPABASE_URL) {
    config.supabaseUrl = process.env.SUPABASE_URL;
  }

  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    config.supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  return config;
};
