import { expect, test } from "bun:test"

import { createQueryClientConfig } from "./query-config"

test("static overrides preserve oRPC hashing and defaults in other sections", () => {
  const config = createQueryClientConfig({
    defaultOptions: {
      queries: { staleTime: 30_000, retry: false },
      mutations: { retry: 2 },
    },
  })
  expect(config.defaultOptions?.queries).toMatchObject({ staleTime: 30_000, retry: false })
  expect(config.defaultOptions?.mutations?.retry).toBe(2)
  const hash = config.defaultOptions!.queries!.queryKeyHashFn!
  const date = new Date("2026-01-01T00:00:00Z")
  expect(hash(["post", { id: 1n, date }])).toBe(hash(["post", { date, id: 1n }]))
  expect(hash([date])).not.toBe(hash([date.toISOString()]))
  expect(hash([1n])).not.toBe(hash(["1"]))
})

test("partial static defaults preserve the default stale time", () => {
  const config = createQueryClientConfig({ defaultOptions: { queries: { retry: false } } })
  expect(config.defaultOptions?.queries?.staleTime).toBe(5_000)
})
