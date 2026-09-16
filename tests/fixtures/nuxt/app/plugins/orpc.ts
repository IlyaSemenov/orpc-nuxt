import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import { defineNuxtPlugin } from "orpc-nuxt/plugin"

import type { router } from "../../server/utils/router"

/** Exercise relative URLs with the module and absolute SSR overrides with an app-owned cache. */
export default defineNuxtPlugin<RouterClient<typeof router>>(() => {
  const requestURL = useRequestURL()
  const custom = useRuntimeConfig().public.customQueryClient

  if (custom) {
    let linkCreations = 0
    return {
      link: ({ event }) => {
        linkCreations++
        if (linkCreations !== 1) throw new Error("The link factory ran more than once for one app")
        if (!event) {
          return new RPCLink({
            origin: requestURL.origin,
            url: "/rpc?transport=browser",
            fetch(url, init) {
              return globalThis.fetch(url, { ...init, credentials: "include" })
            },
          })
        }
        const headers = useRequestHeaders(
          requestURL.pathname === "/no-headers" ? [] : ["Cookie", "x-viewer"],
        )
        return new RPCLink({
          origin: requestURL.origin,
          url: "/rpc?transport=server",
          headers,
          // Capture this request's event in the transport instance used only by its SSR app.
          fetch(url, init) {
            event.context.orpcRequestFetchUsed = true
            return globalThis.fetch(url, init)
          },
        })
      },
    }
  }

  return {
    url: custom ? new URL("/rpc?transport=browser", requestURL).href : "/rpc?transport=shared",
    serverUrl: custom ? new URL("/rpc?transport=server", requestURL).href : undefined,
    credentials: "include",
    forwardHeaders: requestURL.pathname === "/no-headers" ? undefined : ["Cookie", "x-viewer"],
  }
})
