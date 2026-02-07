"use client";

import { createTRPCClient, httpBatchLink, httpSubscriptionLink, splitLink } from "@trpc/client";

import type { AppRouter } from "@/server/trpc/router";

const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8787";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    splitLink({
      condition: (op) => op.type === "subscription",
      true: httpSubscriptionLink({
        url: `${apiBase}/trpc`,
      }),
      false: httpBatchLink({
        url: `${apiBase}/trpc`,
      }),
    }),
  ],
});
