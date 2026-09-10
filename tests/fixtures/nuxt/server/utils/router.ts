import { os } from "@orpc/server"
import * as z from "zod"

const posts = {
  fail: os.handler(() => {
    throw new Error("Failed query")
  }),
  get: os
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .handler(({ input }) => {
      return {
        id: input.id,
        details: { title: `post ${input.id}` },
      }
    }),
  update: os
    .input(
      z.object({
        id: z.number(),
        title: z.string(),
      }),
    )
    .handler(({ input }) => {
      return {
        id: input.id,
        details: { title: input.title },
      }
    }),
  ping: os.handler(() => "pong"),
  stream: os.handler(async function* () {
    yield "event"
  }),
}

/** Exercise request-specific context and Date preservation across RPC and SSR payload transfer. */
export const router = {
  hello: os
    .$context<{ name: string; cookie: string; authorization: string; transport: string }>()
    .handler(({ context }) => {
      return {
        ...context,
        date: new Date("2026-01-01T00:00:00Z"),
      }
    }),
  blog: {
    posts,
    admin: {
      comments: {
        get: posts.get,
      },
    },
    users: {
      get: os.handler(() => {
        return { name: "Ada" }
      }),
    },
    useQuery: { nested: posts.ping },
    useMutation: posts.ping,
    queryOptions: { nested: posts.ping },
  },
}
