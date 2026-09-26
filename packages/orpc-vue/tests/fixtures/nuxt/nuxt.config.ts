import { existsSync } from "node:fs"

// Use the public entrypoint so the fixture checks package exports as well as the built module.
import orpcNuxt from "orpc-vue/nuxt/module"

// Isolated consumers receive a copy of the pages shared by both adapters; the workspace extends them.
const sharedPages = "../../../../core/test-utils/adapter-fixture"

export default defineNuxtConfig({
  extends: existsSync(new URL(sharedPages, import.meta.url)) ? [sharedPages] : [],
  modules: [orpcNuxt],
  // Use the same application layout when this fixture is installed with Nuxt 3 or 4.
  srcDir: "app",
  serverDir: "server",
  orpc: {
    queryClient: {
      defaultOptions: {
        queries: { staleTime: 60_000, retry: false },
      },
    },
  },
  devtools: { enabled: false },
  compatibilityDate: "2026-09-10",
})
