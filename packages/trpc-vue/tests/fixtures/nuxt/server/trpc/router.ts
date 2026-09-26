import { initTRPC } from "@trpc/server"
import superjson from "superjson"
import * as z from "zod"

const t = initTRPC
  .context<{ name: string; cookie: string; authorization: string; transport: string }>()
  .create({ transformer: superjson })

const getPost = t.procedure.input(z.object({ id: z.number() })).query(({ input }) => {
  return {
    id: input.id,
    details: { title: `post ${input.id}` },
  }
})
const ping = t.procedure.query(() => "pong")

const posts = t.router({
  fail: t.procedure.query(() => {
    throw new Error("Failed query")
  }),
  get: getPost,
  update: t.procedure
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
      }),
    )
    .mutation(({ input }) => {
      return {
        id: input.id,
        details: { title: input.title },
      }
    }),
  list: t.procedure.query(() => {
    return [{ id: 1, title: "post 1" }]
  }),
  ping,
  stream: t.procedure.query(async function* () {
    yield "event"
  }),
})

/** Exercise request-specific context and Date preservation across RPC and SSR payload transfer. */
export const router = t.router({
  hello: t.procedure.query(({ ctx }) => {
    return {
      ...ctx,
      date: new Date("2026-01-01T00:00:00Z"),
    }
  }),
  transport: t.procedure.query(({ ctx }) => ctx.transport),
  blog: t.router({
    posts,
    admin: t.router({
      comments: t.router({
        get: getPost,
      }),
    }),
    users: t.router({
      get: t.procedure.query(() => {
        return { name: "Ada" }
      }),
    }),
    useQuery: t.router({ nested: ping }),
    useMutation: ping,
    queryOptions: t.router({ nested: ping }),
  }),
})

export type AppRouter = typeof router
