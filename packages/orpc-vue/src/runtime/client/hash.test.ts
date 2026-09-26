import { expect, test } from "bun:test"

import { createORPCClient } from "@orpc/client"
import { dehydrate, hydrate, QueryClient } from "@tanstack/vue-query"
import { effectScope } from "vue"

import { createORPCVueQuery } from "./create"
import { hashORPCKey } from "./hash"

test("hashing ignores object key order but distinguishes typed values from their JSON forms", () => {
  const date = new Date("2026-01-01T00:00:00Z")
  expect(hashORPCKey(["post", { id: 1n, date }])).toBe(hashORPCKey(["post", { date, id: 1n }]))
  expect(hashORPCKey([date])).not.toBe(hashORPCKey([date.toISOString()]))
  expect(hashORPCKey([1n])).not.toBe(hashORPCKey(["1"]))
})

/** Exercise namespace defaults through observers, direct cache access and restored entries. */
test("typed input addresses one entry through fetching, writes, invalidation and hydration", async () => {
  let calls = 0
  const raw = createORPCClient<{
    read: (input: { date: Date | string; id: bigint }) => Promise<{ count: number }>
  }>({
    async call() {
      return { count: ++calls }
    },
  })
  const cache = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
  const scope = effectScope()
  const orpc = createORPCVueQuery(raw, { queryClient: cache, prefix: "orpc" })
  const input = { date: new Date("2026-01-01T00:00:00Z"), id: 1n }
  try {
    const query = await scope.run(() => orpc.read.useQuery(input))!
    const key = orpc.read.queryKey({ input })
    const stringKey = orpc.read.queryKey({ input: { ...input, date: input.date.toISOString() } })
    expect(cache.getQueryData(key)).toEqual({ count: 1 })
    expect(cache.getQueryData(stringKey)).toBeUndefined()
    query.data.value = { count: 2 }
    expect(cache.getQueryData(key)).toEqual({ count: 2 })
    cache.setQueryData(key, { count: 3 })
    expect(query.data.value).toEqual({ count: 3 })
    await query.invalidate()
    expect(calls).toBe(2)
    expect(cache.getQueryCache().getAll()).toHaveLength(1)
    const restored = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } })
    const restoredScope = effectScope()
    try {
      // Nuxt hydrates before RPC plugins register their namespace defaults.
      hydrate(restored, dehydrate(cache))
      const restoredClient = createORPCVueQuery(raw, { queryClient: restored, prefix: "orpc" })
      expect(restored.getQueryCache().find({ queryKey: key, exact: true })).toBeDefined()
      const hydrated = await restoredScope.run(() => restoredClient.read.useQuery(input))!
      expect(hydrated.data.value).toEqual(query.data.value)
      expect(calls).toBe(2)
    } finally {
      restoredScope.stop()
      restored.clear()
    }
  } finally {
    scope.stop()
    cache.clear()
  }
})
