import { type AnyNestedClient, createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import {
  defineNuxtPlugin as createNuxtPlugin,
  type NuxtApp,
  type Plugin,
  useRequestHeaders,
  useRequestURL,
} from "nuxt/app"

import { createORPCNuxtClient } from "../client/create"
import type { ORPCNuxtClient, ORPCNuxtClientOptions } from "../types"
import { resolveQueryClient } from "../vue-query/query-client"

/** Configure the HTTP transport and cache used by a Nuxt app's injected oRPC client. */
export interface OrpcPluginOptions extends ORPCNuxtClientOptions {
  /** RPC handler URL, including its path; relative URLs resolve against the current page URL. */
  url: string
  /** Optional SSR handler URL; an absent or empty value falls back to url. */
  serverUrl?: string
  /** Fetch credentials policy, for example include for cross-origin browser cookies. */
  credentials?: RequestCredentials
  /** Incoming headers to forward during SSR; only explicitly listed headers are forwarded. */
  forwardHeaders?: readonly string[]
}

/**
 * Create an HTTP client per Nuxt app and provide it as $orpc with inferred router types.
 * The setup callback runs once per SSR request and once when the browser app starts.
 * Install Vue Query before this plugin, or return an explicit queryClient from setup.
 * Its QueryClient is captured immediately, so invalidate works before any composable runs.
 */
export function defineNuxtPlugin<T extends AnyNestedClient>(
  setup: (nuxtApp: NuxtApp) => OrpcPluginOptions,
): Plugin<{ orpc: ORPCNuxtClient<T> }> {
  return createNuxtPlugin((nuxtApp) => {
    const options = setup(nuxtApp)
    const queryClient = options.queryClient ?? resolveQueryClient(nuxtApp.vueApp)
    if (!queryClient) {
      throw new Error(
        "orpc-nuxt: install Vue Query before the oRPC plugin. Enable the module's QueryClient, use enforce: 'pre' in your Vue Query plugin, or pass queryClient explicitly.",
      )
    }

    const url = import.meta.server ? options.serverUrl || options.url : options.url
    const endpoint = new URL(url, useRequestURL())
    if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
      throw new Error("orpc-nuxt: the RPC handler URL must use HTTP or HTTPS.")
    }
    const link = new RPCLink({
      // oRPC v2 accepts the origin separately from the handler path and query string.
      origin: endpoint.origin,
      // HTTP URL.pathname always starts with the slash required by StandardUrl.
      url: `${endpoint.pathname}${endpoint.search}` as `/${string}`,
      // An explicit empty list is essential: undefined would forward every incoming header.
      headers: useRequestHeaders([...(options.forwardHeaders ?? [])]),
      fetch(url, init) {
        return globalThis.fetch(url, {
          ...init,
          credentials: options.credentials,
        })
      },
    })
    const client = createORPCClient<T>(link)
    const orpc = createORPCNuxtClient(client, {
      prefix: options.prefix,
      queryClient,
    })
    return {
      provide: { orpc },
    }
  })
}
