import { createTRPCClient, httpSubscriptionLink } from "@trpc/client";
import { EventSource } from "eventsource";

import type { AppRouter } from "../../src/server/trpc/router";

const apiBase = process.env.SSE_API_BASE_URL ?? "http://localhost:8787";
const durationMs = Number.parseInt(process.env.SSE_TEST_DURATION_MS ?? "20000", 10);
const clients = Number.parseInt(process.env.SSE_TEST_CLIENTS ?? "30", 10);
const replay = Number.parseInt(process.env.SSE_TEST_REPLAY ?? "1", 10);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const run = async () => {
  let errorCount = 0;
  let messageCount = 0;
  const clientsWithData = new Set<number>();

  const unsubs: Array<() => void> = [];

  for (let index = 0; index < clients; index += 1) {
    const client = createTRPCClient<AppRouter>({
      links: [
        httpSubscriptionLink({
          EventSource: EventSource as never,
          url: `${apiBase}/trpc`,
        }),
      ],
    });

    const subscription = client.dashboard.eirgridDemand.subscribe(
      { replay },
      {
        onData: () => {
          messageCount += 1;
          clientsWithData.add(index);
        },
        onError: (error) => {
          errorCount += 1;
          console.error(`client ${index} subscription error`, error.message);
        },
      },
    );

    unsubs.push(() => subscription.unsubscribe());
  }

  await sleep(durationMs);

  for (const unsubscribe of unsubs) {
    unsubscribe();
  }

  const passRate = clients === 0 ? 1 : clientsWithData.size / clients;

  console.log(`SSE load summary:\n- clients: ${clients}\n- durationMs: ${durationMs}\n- messages: ${messageCount}\n- clientsWithData: ${clientsWithData.size}\n- errorCount: ${errorCount}\n- passRate: ${(passRate * 100).toFixed(1)}%`);

  if (errorCount > 0 || passRate < 0.9) {
    process.exit(1);
  }
};

run().catch((error: unknown) => {
  console.error("SSE load test failed", error);
  process.exit(1);
});
