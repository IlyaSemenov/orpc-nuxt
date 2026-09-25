import { expect, test } from "bun:test"

import { createRouterClient, os } from "@orpc/server"
import { QueryClient } from "@tanstack/vue-query"
import { renderToString } from "@vue/server-renderer"
import { createSSRApp, h } from "vue"

import { createORPCVueContext } from "./context"
import { createORPCVueQuery } from "./create"

test("reads the client provided to each Vue app without sharing it across SSR requests", async () => {
  const router = { ping: os.handler(() => "pong") }
  const raw = createRouterClient(router)
  const context = createORPCVueContext<typeof raw>()
  const caches = [new QueryClient(), new QueryClient()]
  const clients = caches.map((queryClient) => createORPCVueQuery(raw, { queryClient }))

  try {
    await Promise.all(
      clients.map(async (client) => {
        const app = createSSRApp({
          setup() {
            expect(context.useOrpc()).toBe(client)
            return () => h("p", "ready")
          },
        })
        app.provide(context.key, client)
        expect(await renderToString(app)).toBe("<p>ready</p>")
      }),
    )
  } finally {
    for (const cache of caches) cache.clear()
  }
})

test("requires the matching provider in an active Vue injection context", () => {
  const raw = createRouterClient({ ping: os.handler(() => "pong") })
  const context = createORPCVueContext<typeof raw>()
  const other = createORPCVueContext<typeof raw>()
  const app = createSSRApp({ render: () => null })

  expect(() => context.useOrpc()).toThrow("Call app.provide(context.key, orpc)")
  expect(() => app.runWithContext(() => context.useOrpc())).toThrow(
    "Call app.provide(context.key, orpc)",
  )
  expect(context.key).not.toBe(other.key)
})
