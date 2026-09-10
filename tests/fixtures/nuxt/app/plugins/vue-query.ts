import {
  type DehydratedState,
  dehydrate,
  hydrate,
  QueryClient,
  VueQueryPlugin,
} from "@tanstack/vue-query"

/** Install and hydrate the application's own cache before the HTTP helper's default-order plugin. */
export default defineNuxtPlugin({
  enforce: "pre",
  async setup(nuxtApp) {
    if (!useRuntimeConfig().public.customQueryClient) return
    const state = useState<DehydratedState | undefined>("custom-query-cache")
    // Finish asynchronous initialization before any default-order plugin captures the cache.
    await Promise.resolve()
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { staleTime: 60_000, retry: false },
      },
    })
    if (import.meta.server) {
      nuxtApp.hook("app:rendered", () => {
        state.value = dehydrate(queryClient)
        queryClient.clear()
      })
    } else if (state.value) {
      hydrate(queryClient, state.value)
      state.value = undefined
    }
    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  },
})
