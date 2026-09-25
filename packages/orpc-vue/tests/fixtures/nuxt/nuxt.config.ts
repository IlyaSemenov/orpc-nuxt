import { env } from "node:process"

// Use the public entrypoint so the fixture checks package exports as well as the built module.
import orpcNuxt from "orpc-vue/nuxt"

const customQueryClient = env.ORPC_TEST_QUERY_CLIENT === "custom"

export default defineNuxtConfig({
  modules: [orpcNuxt],
  // Use the same application layout when this fixture is installed with Nuxt 3 or 4.
  srcDir: "app",
  serverDir: "server",
  runtimeConfig: {
    public: { customQueryClient },
  },
  orpc: {
    queryClient: customQueryClient
      ? false
      : {
          defaultOptions: {
            queries: { staleTime: 60_000, retry: false },
          },
        },
  },
  devtools: { enabled: false },
  compatibilityDate: "2026-09-10",
})
