import {
  type ClientPluginOptions,
  defineClientPlugin,
  type HttpTransportOptions,
  resolveHttpTransport,
  type TransportContext,
} from "@rpc-vue/core/nuxt/client-plugin"
import {
  createTRPCClient,
  httpBatchLink,
  type HTTPBatchLinkOptions,
  type TRPCLink,
} from "@trpc/client"
import type { AnyTRPCRouter } from "@trpc/server"
import type { NuxtApp, Plugin } from "nuxt/app"

import { createTRPCVueQuery } from "../client/create"
import type { TRPCVueQueryClient } from "../types"

export type { TransportContext as TrpcLinkContext } from "@rpc-vue/core/nuxt/client-plugin"

type BatchLinkOptions<TRouter extends AnyTRPCRouter> = HTTPBatchLinkOptions<
  TRouter["_def"]["_config"]["$types"]
>

/** Configure the transport and cache used by a Nuxt app's injected tRPC client. */
export type TrpcPluginOptions<TRouter extends AnyTRPCRouter> = ClientPluginOptions<
  {
    /** Use application-owned links or create them for each Nuxt application. */
    links: TRPCLink<TRouter>[] | ((context: TransportContext) => TRPCLink<TRouter>[])
  },
  Pick<BatchLinkOptions<TRouter>, "transformer">
>

/**
 * Create a tRPC client per Nuxt app and provide it as $trpc with inferred router types.
 * The setup callback runs once per SSR request and once when the browser app starts.
 * A custom links factory also runs once per app and receives its Nuxt app and H3 event.
 * Install Vue Query before this plugin, or return an explicit queryClient from setup.
 * Its QueryClient is captured immediately, so invalidate works before any composable runs.
 */
export function defineNuxtPlugin<TRouter extends AnyTRPCRouter>(
  setup: (nuxtApp: NuxtApp) => TrpcPluginOptions<TRouter>,
): Plugin<{ trpc: TRPCVueQueryClient<TRouter> }> {
  return defineClientPlugin("trpc-vue", setup, (options, transport, queryClient) => {
    const links =
      typeof options.links === "function"
        ? options.links(transport)
        : (options.links ?? [createHTTPLink(options)])
    return {
      trpc: createTRPCVueQuery(createTRPCClient<TRouter>({ links }), {
        prefix: options.prefix,
        queryClient,
      }),
    }
  })
}

/** Build the helper's default batching link after the custom-links branch has been excluded. */
function createHTTPLink<TRouter extends AnyTRPCRouter>(
  options: HttpTransportOptions & Pick<BatchLinkOptions<TRouter>, "transformer">,
) {
  const { url, headers, fetch } = resolveHttpTransport(options, "trpc-vue")
  // TypeScript cannot resolve whether a generic router requires the transformer option.
  return httpBatchLink<TRouter>({
    url: url.href,
    transformer: options.transformer,
    headers,
    fetch,
  } as BatchLinkOptions<TRouter>)
}
