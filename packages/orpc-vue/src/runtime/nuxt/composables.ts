import { useNuxtQueryClient } from "@rpc-vue/core/nuxt/composables"
import type { QueryClient } from "@tanstack/vue-query"
import { type NuxtApp, useNuxtApp } from "nuxt/app"

// Preserve the application's inferred router instead of declaring a generic $orpc injection.
type InjectedORPCClient = NuxtApp extends { $orpc: infer TClient } ? TClient : never

/**
 * Read the typed client provided by your application's oRPC plugin.
 * Requires an active Nuxt context and a plugin that provides `orpc`.
 * The router type is inferred from that plugin's return value.
 */
export function useOrpc(): InjectedORPCClient {
  const client = useNuxtApp().$orpc
  if (!client) {
    throw new Error("Provide an oRPC client from a Nuxt plugin before calling useOrpc().")
  }
  return client as InjectedORPCClient
}

/**
 * Read the QueryClient installed for this Nuxt app, by the module or by your own plugin.
 * Unlike Vue Query's own accessor, this ignores component-level providers and works outside
 * a component, for example in an event handler or when clearing the cache between tests.
 * The browser keeps the Nuxt context available after startup; during server rendering,
 * call this inside nuxtApp.runWithContext().
 * Throws when no QueryClient is installed, as with queryClient: false and no Vue Query plugin.
 */
export function useOrpcQueryClient(): QueryClient {
  return useNuxtQueryClient("useOrpcQueryClient")
}
