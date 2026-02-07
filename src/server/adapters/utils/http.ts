import type { AdapterPollContext } from "@/server/adapters/core/types";

export const fetchJson = async <T>(
  url: string,
  context: AdapterPollContext,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetch(url, {
    ...init,
    signal: context.signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return (await response.json()) as T;
};

export const fetchText = async (
  url: string,
  context: AdapterPollContext,
  init?: RequestInit,
): Promise<string> => {
  const response = await fetch(url, {
    ...init,
    signal: context.signal,
  });

  if (!response.ok) {
    throw new Error(`Request failed ${response.status} for ${url}`);
  }

  return response.text();
};
