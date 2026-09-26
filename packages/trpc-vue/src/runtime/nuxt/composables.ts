import { useNuxtQueryClient } from "@rpc-vue/core/nuxt/composables"
import type { QueryClient } from "@tanstack/vue-query"
import { type NuxtApp, useNuxtApp } from "nuxt/app"

// Preserve the application's inferred router instead of declaring a generic $trpc injection.
type InjectedTRPCClient = NuxtApp extends { $trpc: infer TClient } ? TClient : never

/**
 * Read the typed client provided by your application's tRPC plugin.
 * Requires an active Nuxt context and a plugin that provides `trpc`.
 * The router type is inferred from that plugin's return value.
 */
export function useTrpc(): InjectedTRPCClient {
  const client = useNuxtApp().$trpc
  if (!client) {
    throw new Error("Provide a tRPC client from a Nuxt plugin before calling useTrpc().")
  }
  return client as InjectedTRPCClient
}

/**
 * Read the QueryClient installed for this Nuxt app, by the module or by your own plugin.
 * Unlike Vue Query's own accessor, this ignores component-level providers and works outside
 * a component, for example in an event handler or when clearing the cache between tests.
 * The browser keeps the Nuxt context available after startup; during server rendering,
 * call this inside nuxtApp.runWithContext().
 * Throws when no QueryClient is installed, as with queryClient: false and no Vue Query plugin.
 */
export function useTrpcQueryClient(): QueryClient {
  return useNuxtQueryClient("useTrpcQueryClient")
}
