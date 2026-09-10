import type { RouterClient } from "@orpc/server"
import { defineNuxtPlugin } from "orpc-nuxt/plugin"

import type { router } from "../../server/utils/router"

/** Exercise relative URLs with the module and absolute SSR overrides with an app-owned cache. */
export default defineNuxtPlugin<RouterClient<typeof router>>(() => {
  const requestURL = useRequestURL()
  const custom = useRuntimeConfig().public.customQueryClient

  return {
    url: custom ? new URL("/rpc?transport=browser", requestURL).href : "/rpc?transport=shared",
    serverUrl: custom ? new URL("/rpc?transport=server", requestURL).href : undefined,
    credentials: "include",
    forwardHeaders: requestURL.pathname === "/no-headers" ? undefined : ["Cookie", "x-viewer"],
  }
})
