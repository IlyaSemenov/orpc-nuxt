import {
  type DehydratedState,
  dehydrate,
  hydrate,
  QueryClient,
  VueQueryPlugin,
} from "@tanstack/vue-query"
import { type NuxtApp, useState } from "nuxt/app"

// Include the Nuxt hook augmentation without adding a runtime import.
import type {} from "./hooks"
import { createQueryClientConfig, type StaticQueryClientConfig } from "./query-config"

/** Install one Vue Query cache per Nuxt app and transfer server data through its payload. */
export default function createQueryClientSetup(options: StaticQueryClientConfig = {}) {
  return async function setup(nuxtApp: NuxtApp) {
    // Capture Nuxt state before the awaited customization hook can leave the active context.
    const state = useState<DehydratedState | undefined>("orpc-nuxt:query-cache")
    const config = createQueryClientConfig(options)
    await nuxtApp.callHook("orpc:query-client", config)
    // Never share a module-level cache between SSR requests with different user contexts.
    const queryClient = new QueryClient(config)

    if (import.meta.server) {
      nuxtApp.hook("app:rendered", () => {
        state.value = dehydrate(queryClient)
        // Release request resources only after the payload has captured the completed queries.
        queryClient.clear()
      })
      nuxtApp.hook("app:error", () => queryClient.clear())
    } else {
      // Hydrate before observers mount, then release the payload's redundant cache snapshot.
      if (state.value) hydrate(queryClient, state.value)
      state.value = undefined
    }
    nuxtApp.vueApp.use(VueQueryPlugin, { queryClient })
  }
}
