import {
  hashKey,
  partialMatchKey,
  type QueryClient,
  type QueryKey,
  type QueryKeyHashFunction,
} from "@tanstack/vue-query"

type HashFunction = QueryKeyHashFunction<QueryKey>

/** Global key hashing that routes each registered namespace to its own hashing. */
type NamespaceHashing = HashFunction & {
  // A string property, unlike a module-level symbol, is shared by separately bundled core copies.
  rpcVueNamespaces: Map<string, { namespace: QueryKey; queryKeyHashFn: HashFunction }>
}

/**
 * Register namespace hashing and reconcile restored entries without changing their cache identity.
 * Hashing is registered as a QueryClient default rather than on observers, because imperative
 * cache access and invalidation resolve keys through defaults too.
 * It is registered as the global default because TanStack merges per-key defaults in registration
 * order: a namespace entry added now would override application defaults registered earlier
 * for more specific keys.
 * Per-key application defaults therefore keep precedence, and keys outside every registered
 * namespace keep the previous global hashing.
 */
export function registerQueryKeyHash(
  cache: QueryClient,
  namespace: QueryKey,
  queryKeyHashFn: HashFunction,
) {
  const defaults = cache.getDefaultOptions()
  const current = defaults.queries?.queryKeyHashFn as
    | (HashFunction & Partial<NamespaceHashing>)
    | undefined
  let namespaces = current?.rpcVueNamespaces
  if (!namespaces) {
    const fallback: HashFunction = current ?? hashKey
    const registered: NamespaceHashing["rpcVueNamespaces"] = new Map()
    const dispatch = (queryKey: QueryKey) => {
      for (const entry of registered.values()) {
        if (partialMatchKey(queryKey, entry.namespace)) return entry.queryKeyHashFn(queryKey)
      }
      return fallback(queryKey)
    }
    cache.setDefaultOptions({
      ...defaults,
      queries: {
        ...defaults.queries,
        queryKeyHashFn: Object.assign(dispatch, { rpcVueNamespaces: registered }),
      },
    })
    namespaces = registered
  }
  namespaces.set(hashKey(namespace), { namespace, queryKeyHashFn })

  for (const query of cache.getQueryCache().findAll({ queryKey: namespace })) {
    // Hydration can precede client creation, leaving the owner's global hasher on these entries.
    // Resolve per-key defaults too, so a more specific application policy takes precedence.
    let resolved
    try {
      resolved = cache.defaultQueryOptions({ queryKey: query.queryKey })
    } catch {
      // A query-local hasher can support values that namespace hashing cannot serialize.
      continue
    }
    // Preserve entries created with an explicit query-local hash instead of this namespace policy.
    if (resolved.queryHash === query.queryHash) {
      query.setOptions({ ...query.options, queryKeyHashFn: resolved.queryKeyHashFn })
    }
  }
}
