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
