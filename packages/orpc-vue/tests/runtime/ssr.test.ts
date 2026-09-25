import { afterEach, expect, test } from "bun:test"

import { createRouterClient, os } from "@orpc/server"
import { dehydrate, hydrate, QueryClient, VueQueryPlugin } from "@tanstack/vue-query"
import { renderToString } from "@vue/server-renderer"
import { createORPCVueQuery } from "orpc-vue"
import { createSSRApp, h } from "vue"

const clients: QueryClient[] = []
afterEach(() => {
  for (const client of clients.splice(0)) client.clear()
})

test("SSR waits for unawaited queries, isolates request caches and reuses hydrated data", async () => {
  let calls = 0
  const router = {
    viewer: os.$context<{ name: string }>().handler(async ({ context }) => {
      calls++
      await Promise.resolve()
      return { name: context.name }
    }),
  }
  /** Render an isolated app, optionally seeding its cache with a previous app's payload. */
  async function render(name: string, state?: ReturnType<typeof dehydrate>) {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: Infinity, retry: false },
      },
    })
    clients.push(queryClient)
    if (state) hydrate(queryClient, state)
    const client = createRouterClient(router, {
      context: { name },
    })
    const orpc = createORPCVueQuery(client)
    const app = createSSRApp({
      setup() {
        // Deliberately omit await: onServerPrefetch must still hold rendering for this query.
        const query = orpc.viewer.useQuery()
        return () => h("p", query.data.value?.name)
      },
    })
    app.use(VueQueryPlugin, { queryClient })
    const html = await renderToString(app)
    return {
      html,
      state: dehydrate(queryClient),
    }
  }
  const [alice, bob] = await Promise.all([render("Alice"), render("Bob")])
  expect(alice.html).toBe("<p>Alice</p>")
  expect(bob.html).toBe("<p>Bob</p>")
  expect(calls).toBe(2)
  // A different context makes any accidental refetch observable in both HTML and call count.
  const hydrated = await render("should not fetch", alice.state)
  expect(hydrated.html).toBe("<p>Alice</p>")
  expect(calls).toBe(2)
})

test("server: false never starts or awaits an SSR request", async () => {
  let calls = 0
  const router = {
    browser: os.handler(() => {
      calls++
      return "browser"
    }),
  }
  const queryClient = new QueryClient()
  clients.push(queryClient)
  const client = createRouterClient(router)
  const orpc = createORPCVueQuery(client, { queryClient })
  const app = createSSRApp({
    async setup() {
      const query = await orpc.browser.useQuery(undefined, { server: false })
      return () => h("p", query.data.value ?? "pending")
    },
  })
  expect(await renderToString(app)).toBe("<p>pending</p>")
  expect(calls).toBe(0)
})
