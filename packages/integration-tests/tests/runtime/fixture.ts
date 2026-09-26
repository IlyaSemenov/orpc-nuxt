import { createRouterClient, os } from "@orpc/server"
import { QueryClient } from "@tanstack/vue-query"
import { createTRPCClient, unstable_localLink } from "@trpc/client"
import { initTRPC } from "@trpc/server"
import { createORPCVueQuery } from "orpc-vue"
import { createTRPCVueQuery } from "trpc-vue"
import { effectScope } from "vue"
import * as z from "zod"

const t = initTRPC.context<{ viewer: string }>().create()
const trpcRouter = t.router({
  blog: t.router({
    get: t.procedure.input(z.object({ id: z.number() })).query(({ input, ctx }) => ({
      id: input.id,
      title: `trpc ${ctx.viewer}`,
      details: { label: "original" },
    })),
  }),
  date: t.procedure.query(() => new Date("2026-01-01T00:00:00Z")),
})
const orpcRouter = {
  blog: {
    get: os
      .$context<{ viewer: string }>()
      .input(z.object({ id: z.number() }))
      .handler(({ input, context }) => ({
        id: input.id,
        title: `orpc ${context.viewer}`,
        details: { label: "original" },
      })),
  },
}

/** Same procedure paths and inputs deliberately exercise collisions on one cache. */
export function fixture(
  viewer = "visitor",
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  }),
) {
  const trpcClient = createTRPCClient<typeof trpcRouter>({
    links: [unstable_localLink({ router: trpcRouter, createContext: async () => ({ viewer }) })],
  })
  const orpcClient = createRouterClient(orpcRouter, { context: { viewer } })
  const trpc = createTRPCVueQuery(trpcClient, { prefix: "trpc", queryClient })
  const orpc = createORPCVueQuery(orpcClient, { prefix: "orpc", queryClient })
  const scope = effectScope()
  return {
    trpcClient,
    orpcClient,
    trpc,
    orpc,
    queryClient,
    scope,
    dispose() {
      scope.stop()
      queryClient.clear()
    },
  }
}
