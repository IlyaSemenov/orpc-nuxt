import { expect, test } from "bun:test"

import { QueryClient, VUE_QUERY_CLIENT, VueQueryPlugin } from "@tanstack/vue-query"
import { renderToString } from "@vue/server-renderer"
import { createSSRApp, defineComponent, h, provide } from "vue"

import { resolveQueryClient } from "./query-client"

test("resolves an application's QueryClient outside any injection context", () => {
  const queryClient = new QueryClient()
  const app = createSSRApp({ render: () => null })
  app.use(VueQueryPlugin, { queryClient })
  expect(resolveQueryClient()).toBeUndefined()
  expect(resolveQueryClient(app)).toBe(queryClient)
})

test("resolves nothing when Vue Query is not installed", () => {
  expect(resolveQueryClient(createSSRApp({ render: () => null }))).toBeUndefined()
})

test("reads an application over a component's own cache, and the context without one", async () => {
  const appQueryClient = new QueryClient()
  const providedQueryClient = new QueryClient()
  let fromApp: QueryClient | undefined
  let fromContext: QueryClient | undefined
  const child = defineComponent({
    setup() {
      fromApp = resolveQueryClient(app)
      fromContext = resolveQueryClient()
      return () => null
    },
  })
  const app = createSSRApp({
    setup() {
      provide(VUE_QUERY_CLIENT, providedQueryClient)
      return () => h(child)
    },
  })
  app.use(VueQueryPlugin, { queryClient: appQueryClient })
  await renderToString(app)
  expect(fromApp).toBe(appQueryClient)
  expect(fromContext).toBe(providedQueryClient)
})
