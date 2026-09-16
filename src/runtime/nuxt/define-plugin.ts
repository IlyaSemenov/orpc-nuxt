import {
  type AnyNestedClient,
  type ClientLink,
  createORPCClient,
  type InferClientContext,
} from "@orpc/client"
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

/** Nuxt state available while creating one app's custom oRPC link. */
export interface OrpcLinkContext {
  /** The Nuxt application that will own the client. */
  nuxtApp: NuxtApp
  /** The current H3 request event during SSR, or undefined in the browser. */
  event: NonNullable<NuxtApp["ssrContext"]>["event"] | undefined
}

/** Configure the transport and cache used by a Nuxt app's injected oRPC client. */
export type OrpcPluginOptions<T extends AnyNestedClient = AnyNestedClient> = ORPCNuxtClientOptions &
  (
    | {
        /** Use an application-owned link or create one for each Nuxt application. */
        link:
          | ClientLink<InferClientContext<T>>
          | ((context: OrpcLinkContext) => ClientLink<InferClientContext<T>>)
        url?: never
        serverUrl?: never
        credentials?: never
        forwardHeaders?: never
      }
    | {
        link?: never
        /** RPC handler URL, including its path; relative URLs resolve against the current page URL. */
        url: string
        /** Optional SSR handler URL; an absent or empty value falls back to url. */
        serverUrl?: string
        /** Fetch credentials policy, for example include for cross-origin browser cookies. */
        credentials?: RequestCredentials
        /** Incoming headers to forward during SSR; only explicitly listed headers are forwarded. */
        forwardHeaders?: readonly string[]
      }
  )

/**
 * Create an oRPC client per Nuxt app and provide it as $orpc with inferred router types.
 * The setup callback runs once per SSR request and once when the browser app starts.
 * A custom link factory also runs once per app and receives its Nuxt app and H3 event.
 * Install Vue Query before this plugin, or return an explicit queryClient from setup.
 * Its QueryClient is captured immediately, so invalidate works before any composable runs.
 */
export function defineNuxtPlugin<T extends AnyNestedClient>(
  setup: (nuxtApp: NuxtApp) => OrpcPluginOptions<T>,
): Plugin<{ orpc: ORPCNuxtClient<T> }> {
  return createNuxtPlugin((nuxtApp) => {
    const options = setup(nuxtApp)
    const queryClient = options.queryClient ?? resolveQueryClient(nuxtApp.vueApp)
    if (!queryClient) {
      throw new Error(
        "orpc-nuxt: install Vue Query before the oRPC plugin. Enable the module's QueryClient, use enforce: 'pre' in your Vue Query plugin, or pass queryClient explicitly.",
      )
    }

    const link =
      typeof options.link === "function"
        ? options.link({ nuxtApp, event: nuxtApp.ssrContext?.event })
        : (options.link ?? createHTTPLink(options))
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

/** Build the helper's default HTTP link after the custom-link branch has been excluded. */
function createHTTPLink(options: Extract<OrpcPluginOptions, { link?: never }>) {
  const url = import.meta.server ? options.serverUrl || options.url : options.url
  const endpoint = new URL(url, useRequestURL())
  if (endpoint.protocol !== "http:" && endpoint.protocol !== "https:") {
    throw new Error("orpc-nuxt: the RPC handler URL must use HTTP or HTTPS.")
  }
  return new RPCLink({
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
}
