import { RPCJsonSerializer } from "@orpc/client"
import { hashKey, type QueryClientConfig } from "@tanstack/vue-query"

/** Remove callbacks from module options; their closures belong in the runtime hook. */
type StaticValue<T> = T extends ((...args: never[]) => unknown) | symbol
  ? never
  : T extends readonly (infer Item)[]
    ? StaticValue<Item>[]
    : T extends object
      ? { [K in keyof T]: StaticValue<T[K]> }
      : T

/** QueryClient defaults that can be included in the Nuxt server and browser bundles. */
export type StaticQueryClientConfig = StaticValue<Pick<QueryClientConfig, "defaultOptions">>

/** Merge module defaults without losing oRPC's support for typed values in query keys. */
export function createQueryClientConfig(options: StaticQueryClientConfig = {}): QueryClientConfig {
  const serializer = new RPCJsonSerializer()
  return {
    defaultOptions: {
      ...options.defaultOptions,
      queries: {
        // Reuse recently fetched SSR data instead of immediately requesting it in the browser.
        staleTime: 5_000,
        ...options.defaultOptions?.queries,
        queryKeyHashFn(queryKey) {
          // Type metadata distinguishes e.g. a Date from its ISO string; normalize metadata order.
          const { json, meta } = serializer.serialize(queryKey)
          return hashKey([json, meta?.map((entry) => JSON.stringify(entry)).sort()])
        },
      },
    },
  }
}
