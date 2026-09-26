import type { QueryClientConfig, QueryKey, QueryKeyHashFunction } from "@tanstack/vue-query"

/** Remove callbacks from module options; their closures belong in the runtime hook. */
type StaticValue<TValue> = TValue extends ((...args: never[]) => unknown) | symbol
  ? never
  : TValue extends readonly (infer Item)[]
    ? StaticValue<Item>[]
    : TValue extends object
      ? { [TKey in keyof TValue]: StaticValue<TValue[TKey]> }
      : TValue

/** QueryClient defaults that can be included in the Nuxt server and browser bundles. */
export type StaticQueryClientConfig = StaticValue<Pick<QueryClientConfig, "defaultOptions">>

/**
 * Merge module defaults over the SSR-friendly stale time.
 *
 * @param options - Static defaults from the module's nuxt.config section.
 * @param queryKeyHashFn - Global key hashing required by the adapter, which options cannot override.
 */
export function createQueryClientConfig(
  options: StaticQueryClientConfig,
  queryKeyHashFn?: QueryKeyHashFunction<QueryKey>,
): QueryClientConfig {
  return {
    defaultOptions: {
      ...options.defaultOptions,
      queries: {
        // Reuse recently fetched SSR data instead of immediately requesting it in the browser.
        staleTime: 5_000,
        ...options.defaultOptions?.queries,
        ...(queryKeyHashFn && { queryKeyHashFn }),
      },
    },
  }
}
