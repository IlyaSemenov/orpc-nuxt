import { os } from "@orpc/server"
import * as z from "zod"

export const router = {
  blog: {
    posts: {
      get: os
        .$context<{ cookie: string }>()
        .input(z.object({ id: z.number() }))
        .handler(({ input, context }) => ({
          id: input.id,
          title: "orpc",
          cookie: context.cookie,
          date: new Date("2026-01-01T00:00:00Z"),
        })),
    },
  },
}
