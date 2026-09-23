import type { QueryClientConfig } from "@tanstack/vue-query"
import type {} from "nuxt/app"

/** Nuxt hooks available while the module initializes its QueryClient. */
export interface ORPCRuntimeHooks {
  /**
   * Mutate the configuration before the per-app QueryClient is created and installed.
   * Async handlers finish before initialization continues.
   */
  "orpc:query-client": (config: QueryClientConfig) => void | Promise<void>
}

declare module "nuxt/app" {
  interface RuntimeNuxtHooks extends ORPCRuntimeHooks {}
}
