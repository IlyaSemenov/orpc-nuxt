import { QueryClient } from "@tanstack/vue-query"
import { createTRPCClient, unstable_localLink } from "@trpc/client"
import { initTRPC } from "@trpc/server"
import { createTRPCVueQuery } from "trpc-vue"
import { effectScope } from "vue"
import * as z from "zod"

const t = initTRPC.context<{ viewer: string }>().create({
  errorFormatter: ({ shape }) => ({ ...shape, data: { ...shape.data, reason: "typed reason" } }),
})
export const router = t.router({
  blog: t.router({
    get: t.procedure.input(z.object({ id: z.number() })).query(({ input, ctx }) => ({
      id: input.id,
      title: `trpc ${ctx.viewer}`,
      details: { label: "original" },
    })),
    save: t.procedure.input(z.object({ title: z.string() })).mutation(({ input }) => input),
    pages: t.procedure
      .input(
        z.object({
          group: z.string(),
          cursor: z.number().nullish(),
          direction: z.enum(["forward", "backward"]).optional(),
        }),
      )
      .query(({ input }) => ({ ...input, next: (input.cursor ?? 0) + 1 })),
  }),
  date: t.procedure.query(() => new Date("2026-01-01T00:00:00Z")),
  stream: t.procedure.query(async function* () {
    yield "chunk"
  }),
  events: t.procedure.subscription(async function* () {
    yield "event"
  }),
  useQuery: t.router({ nested: t.procedure.query(() => "collision") }),
})
/** Create an isolated tRPC client, observer scope and cache for one test. */
export function fixture(
  viewer = "visitor",
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  }),
) {
  const raw = createTRPCClient<typeof router>({
    links: [unstable_localLink({ router, createContext: async () => ({ viewer }) })],
  })
  const trpc = createTRPCVueQuery<typeof router>(raw, { prefix: "trpc", queryClient })
  const scope = effectScope()
  return {
    raw,
    trpc,
    queryClient,
    scope,
    dispose() {
      scope.stop()
      queryClient.clear()
    },
  }
}
