import { initTRPC } from "@trpc/server";
import { z } from "zod";

import type { TrpcContext } from "@/server/trpc/context";

const t = initTRPC.context<TrpcContext>().create();

const publicProcedure = t.procedure;

export const appRouter = t.router({
  health: t.router({
    status: publicProcedure.query(() => ({
      ok: true,
      service: "live-ireland-api",
      now: new Date().toISOString(),
    })),
  }),
  dashboard: t.router({
    latestEirgridDemand: publicProcedure.query(({ ctx }) => {
      return ctx.channel.latest();
    }),
    eirgridDemand: publicProcedure
      .input(
        z
          .object({
            replay: z.number().min(1).max(288).default(24),
          })
          .optional(),
      )
      .subscription(async function* ({ ctx, input, signal }) {
        const replay = ctx.channel.replay(input?.replay ?? 24);

        for (const snapshot of replay) {
          yield snapshot;
        }

        for await (const snapshot of ctx.channel.stream(signal)) {
          yield snapshot;
        }
      }),
    adapterStatuses: publicProcedure.query(({ ctx }) => {
      return ctx.adapterManager.getStatuses();
    }),
    latestAdapterSnapshot: publicProcedure
      .input(
        z.object({
          adapterId: z.string().min(1),
        }),
      )
      .query(({ ctx, input }) => {
        return ctx.adapterManager.getLatest(input.adapterId);
      }),
  }),
});

export type AppRouter = typeof appRouter;
