import type { QueryClient } from "@tanstack/vue-query"
import type { Ref } from "vue"

/** Configure cache ownership and key namespacing when wrapping an application-owned client. */
export interface ClientOptions {
  /**
   * Separate this client's cache keys and root invalidation from other clients sharing a
   * QueryClient; give each of them a distinct nonempty prefix.
   */
  prefix?: string
  /** Use an explicit client when creating composables in an effect scope without Vue injection. */
  queryClient?: QueryClient
}

/** Extract the options object from Vue Query's ref/getter wrappers before replacing fields. */
export type ResolveOptions<TOptions> =
  TOptions extends Ref<infer TResolvedOptions>
    ? TResolvedOptions
    : TOptions extends () => infer TResolvedOptions
      ? ResolveOptions<TResolvedOptions>
      : TOptions
