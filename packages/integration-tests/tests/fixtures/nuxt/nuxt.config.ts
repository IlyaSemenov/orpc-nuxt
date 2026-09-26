import { env } from "node:process"

import orpcNuxt from "orpc-vue/nuxt/module"
import trpcNuxt from "trpc-vue/nuxt/module"

// Select which module owns the cache; "application" enables the application-query-client plugin.
const owner = env.RPC_TEST_OWNER ?? "orpc"
const defaults = { defaultOptions: { queries: { staleTime: 60_000, retry: false } } }

export default defineNuxtConfig({
  modules: [orpcNuxt, trpcNuxt],
  srcDir: "app",
  serverDir: "server",
  runtimeConfig: {
    public: { applicationQueryClient: owner === "application" },
  },
  orpc: { queryClient: owner === "orpc" || owner === "both" ? defaults : false },
  trpc: { queryClient: owner === "trpc" || owner === "both" ? defaults : false },
  devtools: { enabled: false },
  compatibilityDate: "2026-09-10",
})
