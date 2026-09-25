import type { AnyNestedClient } from "@orpc/client"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { type QueryKey, useQueryClient } from "@tanstack/vue-query"

import type { ORPCVueQueryClient, ORPCVueQueryOptions } from "../types"
import { useORPCMutation } from "../vue-query/mutation"
import { useORPCQuery } from "../vue-query/query"
import { resolveQueryClient } from "../vue-query/query-client"
import { decorateClient } from "./decorate"
import { catchDefinedErrors } from "./error"

/**
 * Add reactive query and mutation composables while preserving oRPC's TanStack utilities.
 * Accepts either an HTTP client or a server client bound to the current request context.
 * Creating the wrapper does not start requests or require a Vue effect scope;
 * calling its composables does require an active scope.
 *
 * @param client - The application-owned oRPC client whose router types are preserved.
 * @param options - Cache key prefix and an optional QueryClient for standalone usage.
 */
export function createORPCVueQuery<T extends AnyNestedClient>(
  client: T,
  options: ORPCVueQueryOptions = {},
): ORPCVueQueryClient<T> {
  const utils = createTanstackQueryUtils(client, { prefix: options.prefix })
  // Capture the app's cache while injection is available; mutation callbacks run outside setup.
  let queryClient = options.queryClient ?? resolveQueryClient()

  /** Resolve lazily for clients created outside Vue, then reuse the same cache in callbacks. */
  function getQueryClient() {
    return (queryClient ??= useQueryClient())
  }

  /** Bind composables to one utility node without invoking Vue hooks during traversal. */
  function createMethods(target: object) {
    return {
      useQuery(input: unknown, queryOptions: unknown) {
        return useORPCQuery(target, input, queryOptions, getQueryClient())
      },
      useMutation(mutationOptions: unknown) {
        return useORPCMutation(target, mutationOptions, getQueryClient())
      },
      callCatching(input: unknown, handlers: Record<string, unknown>, callOptions: unknown) {
        const utils = target as { call: (input: unknown, options: unknown) => Promise<unknown> }
        return catchDefinedErrors(utils.call(input, callOptions), handlers)
      },
      invalidate() {
        const utils = target as { key: () => QueryKey }
        return getQueryClient().invalidateQueries({ queryKey: utils.key() })
      },
    }
  }

  return decorateClient(utils, createMethods) as ORPCVueQueryClient<T>
}
