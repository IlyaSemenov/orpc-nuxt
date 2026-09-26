import { hasInjectionContext, inject, type InjectionKey } from "vue"

/**
 * Create a Vue injection key and an accessor for one adapter's decorated client.
 * The context holds no client, so each Vue app or SSR request provides its own instance.
 *
 * @param protocol - Names the protocol in the key description and the missing-provider error.
 * @param accessor - The adapter's public accessor name, used in the missing-provider error.
 * @returns A key for `app.provide()` and an accessor that reads the provided client.
 */
export function createClientContext<TClient>(protocol: string, accessor: string) {
  const key: InjectionKey<TClient> = Symbol(`${protocol} client`)

  function useRpc(): TClient {
    const client = hasInjectionContext() ? inject(key, undefined) : undefined
    if (!client) {
      throw new Error(
        `No ${protocol} client was provided. Call app.provide(context.key, client) before using context.${accessor}().`,
      )
    }
    return client
  }

  return { key, useRpc }
}
