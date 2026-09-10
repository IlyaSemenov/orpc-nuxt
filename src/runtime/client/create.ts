import type { AnyNestedClient } from "@orpc/client"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import {
  type QueryClient,
  type QueryKey,
  useQueryClient,
  VUE_QUERY_CLIENT,
} from "@tanstack/vue-query"
import { hasInjectionContext, inject } from "vue"

import type { ORPCNuxtClient, ORPCNuxtClientOptions } from "../types"
import { useORPCMutation } from "../vue-query/mutation"
import { useORPCQuery } from "../vue-query/query"
import { decorateClient } from "./decorate"

/**
 * Add reactive query and mutation composables while preserving oRPC's TanStack utilities.
 * Accepts either an HTTP client or a server client bound to the current request context.
 * Creating the wrapper does not start requests or require a Vue effect scope;
 * calling its composables does require an active scope.
 *
 * @param client - The application-owned oRPC client whose router types are preserved.
 * @param options - Cache key prefix and an optional QueryClient for standalone usage.
 */
export function createORPCNuxtClient<T extends AnyNestedClient>(
  client: T,
  options: ORPCNuxtClientOptions = {},
): ORPCNuxtClient<T> {
  const utils = createTanstackQueryUtils(client, { prefix: options.prefix })
  // Capture the app's cache while injection is available; mutation callbacks run outside setup.
  let queryClient =
    options.queryClient ??
    (hasInjectionContext()
      ? inject<QueryClient | undefined>(VUE_QUERY_CLIENT, undefined)
      : undefined)

  /** Resolve lazily for clients created outside Vue, then reuse the same cache in callbacks. */
  function resolveQueryClient() {
    return (queryClient ??= useQueryClient())
  }

  /** Bind composables to one utility node without invoking Vue hooks during traversal. */
  function createMethods(target: object) {
    return {
      useQuery(input: unknown, queryOptions: unknown) {
        return useORPCQuery(target, input, queryOptions, resolveQueryClient())
      },
      useMutation(mutationOptions: unknown) {
        return useORPCMutation(target, mutationOptions, resolveQueryClient())
      },
      invalidate() {
        const utils = target as { key: () => QueryKey }
        return resolveQueryClient().invalidateQueries({ queryKey: utils.key() })
      },
    }
  }

  return decorateClient(utils, createMethods) as ORPCNuxtClient<T>
}
