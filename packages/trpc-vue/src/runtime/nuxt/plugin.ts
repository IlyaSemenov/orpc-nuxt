import { createNuxtQueryClientSetup } from "@rpc-vue/core/nuxt/plugin"
import {
  createQueryClientConfig,
  type StaticQueryClientConfig,
} from "@rpc-vue/core/nuxt/query-config"

// Include the Nuxt hook augmentation without adding a runtime import.
import type {} from "./hooks"

/** Install the module-owned cache with its runtime customization hook. */
export default function createQueryClientSetup(options: StaticQueryClientConfig = {}) {
  return createNuxtQueryClientSetup(
    () => createQueryClientConfig(options),
    (nuxtApp, config) => nuxtApp.callHook("trpc:query-client", config),
    "trpc-vue:query-cache",
  )
}
