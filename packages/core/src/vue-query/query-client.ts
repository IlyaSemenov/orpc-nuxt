import {
  type QueryClient,
  type QueryKey,
  type QueryKeyHashFunction,
  useQueryClient,
  VUE_QUERY_CLIENT,
} from "@tanstack/vue-query"
import { type App, hasInjectionContext, inject } from "vue"

import { registerQueryKeyHash } from "./query-hash"

/**
 * Find the QueryClient installed by Vue Query, with or without an active injection context.
 * An application is read directly, so a component providing its own cache cannot shadow the one
 * a plugin captured for the whole application.
 * Without an application, the active injection context is the only source.
 *
 * @param app - The application to read, whatever context the call happens in.
 * @returns The installed QueryClient, or undefined when Vue Query is unavailable.
 */
export function resolveQueryClient(app?: App): QueryClient | undefined {
  if (app) return app.runWithContext(injectQueryClient)
  return hasInjectionContext() ? injectQueryClient() : undefined
}

function injectQueryClient() {
  return inject<QueryClient | undefined>(VUE_QUERY_CLIENT, undefined)
}

/**
 * Capture the QueryClient that a decorated client's composables and invalidation share.
 * Resolves the cache immediately when Vue injection is available, because mutation callbacks and
 * event handlers run outside setup; otherwise resolves it on the first composable call.
 * Registers the namespace's hashing on whichever cache is captured.
 *
 * @param queryClient - An explicit cache that takes precedence over Vue injection.
 * @param namespace - The client's key prefix, or undefined to keep the cache's hashing defaults.
 * @param queryKeyHashFn - Hashing for query keys inside the namespace.
 * @returns A getter that returns the same QueryClient on every call.
 */
export function captureQueryClient(
  queryClient: QueryClient | undefined,
  namespace: QueryKey | undefined,
  queryKeyHashFn: QueryKeyHashFunction<QueryKey>,
): () => QueryClient {
  let captured = queryClient ?? resolveQueryClient()
  if (captured) registerHash(captured)

  function registerHash(cache: QueryClient) {
    if (namespace) registerQueryKeyHash(cache, namespace, queryKeyHashFn)
  }

  return () => {
    if (!captured) {
      captured = useQueryClient()
      registerHash(captured)
    }
    return captured
  }
}
