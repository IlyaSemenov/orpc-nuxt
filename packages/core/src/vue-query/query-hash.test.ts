import { expect, test } from "bun:test"

import { dehydrate, hashKey, hydrate, QueryClient, type QueryKey } from "@tanstack/vue-query"

import { registerQueryKeyHash } from "./query-hash"

const namespaceHash = (queryKey: QueryKey) => `namespace:${hashKey(queryKey)}`

test("registration keeps application defaults registered earlier for more specific keys", () => {
  const cache = new QueryClient()
  const key = ["rpc", "specific"]
  const specificHash = () => "specific-default-hash"
  try {
    cache.setQueryDefaults([], { staleTime: 0 })
    cache.setQueryDefaults(key, { queryKeyHashFn: specificHash, staleTime: 1_000 })
    cache.setQueryData(key, "specific")
    registerQueryKeyHash(cache, ["rpc"], namespaceHash)
    expect(cache.getQueryData<string>(key)).toBe("specific")
    expect(cache.defaultQueryOptions({ queryKey: key }).staleTime).toBe(1_000)
    expect(cache.defaultQueryOptions({ queryKey: ["rpc", "other"] }).queryHash).toBe(
      namespaceHash(["rpc", "other"]),
    )
  } finally {
    cache.clear()
  }
})

test("registration leaves other keys to the previous global hashing and is repeatable", () => {
  const globalHash = (queryKey: QueryKey) => `global:${hashKey(queryKey)}`
  const cache = new QueryClient({ defaultOptions: { queries: { queryKeyHashFn: globalHash } } })
  try {
    registerQueryKeyHash(cache, ["rpc"], namespaceHash)
    const registered = cache.getDefaultOptions().queries?.queryKeyHashFn
    registerQueryKeyHash(cache, ["rpc"], namespaceHash)
    expect(cache.getDefaultOptions().queries?.queryKeyHashFn).toBe(registered)
    expect(cache.defaultQueryOptions({ queryKey: ["other"] }).queryHash).toBe(globalHash(["other"]))
    expect(cache.defaultQueryOptions({ queryKey: ["rpc", 1] }).queryHash).toBe(
      namespaceHash(["rpc", 1]),
    )
  } finally {
    cache.clear()
  }
})

test("registration preserves live query-local hashes", () => {
  const cache = new QueryClient()
  const key = ["rpc", { id: 1n }]
  const localHash = () => "query-local-hash"
  try {
    const local = cache.getQueryCache().build(cache, { queryKey: key, queryKeyHashFn: localHash })
    local.setData("local")
    registerQueryKeyHash(cache, ["rpc"], namespaceHash)
    expect(local.options.queryKeyHashFn).toBe(localHash)
    expect(local.state.data).toBe("local")
  } finally {
    cache.clear()
  }
})

test("registration restores namespace and application hashing on hydrated entries", () => {
  const server = new QueryClient()
  const browser = new QueryClient()
  const namespaceKey = ["rpc", "general"]
  const specificKey = ["rpc", "specific"]
  const specificHash = () => "specific-default-hash"
  try {
    registerQueryKeyHash(server, ["rpc"], namespaceHash)
    server.setQueryDefaults(specificKey, { queryKeyHashFn: specificHash })
    server.setQueryData(namespaceKey, "general")
    server.setQueryData(specificKey, "specific")
    hydrate(browser, dehydrate(server))
    browser.setQueryDefaults(specificKey, { queryKeyHashFn: specificHash })
    registerQueryKeyHash(browser, ["rpc"], namespaceHash)
    for (const [key, data] of [
      [namespaceKey, "general"],
      [specificKey, "specific"],
    ] as const) {
      expect(browser.getQueryData<string>(key)).toBe(data)
      // Exact filters hash with each entry's own options, which hydration set before registration.
      expect(browser.getQueryCache().find({ queryKey: key, exact: true })?.state.data).toBe(data)
    }
  } finally {
    server.clear()
    browser.clear()
  }
})
