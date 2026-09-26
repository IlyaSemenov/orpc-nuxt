import { initTRPC } from "@trpc/server"
import superjson from "superjson"
import * as z from "zod"

const t = initTRPC.context<{ cookie: string }>().create({ transformer: superjson })
export const router = t.router({
  blog: t.router({
    posts: t.router({
      get: t.procedure.input(z.object({ id: z.number() })).query(({ input, ctx }) => ({
        id: input.id,
        title: "trpc",
        cookie: ctx.cookie,
        date: new Date("2026-01-01T00:00:00Z"),
      })),
    }),
  }),
})
export type AppRouter = typeof router
