import { afterEach, expect, test } from "bun:test"

import { fixture } from "./fixture"

const cleanups: (() => void)[] = []

/** Create both clients on one cache, disposed by afterEach. */
function setup() {
  const client = fixture()
  cleanups.push(client.dispose)
  return client
}

afterEach(() => {
  for (const dispose of cleanups.splice(0)) dispose()
})

test("mixed cache: independent results, writes, procedure/branch/root invalidation and ordinary queries", async () => {
  const { trpc, orpc, queryClient, scope } = setup()
  const [t, o] = await scope.run(() =>
    Promise.all([trpc.blog.get.useQuery({ id: 1 }), orpc.blog.get.useQuery({ id: 1 })]),
  )!
  expect(t.data.value?.title).toBe("trpc visitor")
  expect(o.data.value?.title).toBe("orpc visitor")
  t.data.value = { id: 1, title: "edited", details: { label: "changed" } }
  expect(queryClient.getQueryData(trpc.blog.get.queryKey({ id: 1 }))?.title).toBe("edited")
  expect(o.data.value?.title).toBe("orpc visitor")
  scope.stop()
  const keys = [
    trpc.blog.get.queryKey({ id: 1 }),
    trpc.blog.get.queryKey({ id: 2 }),
    trpc.date.queryKey(),
    orpc.blog.get.queryKey({ input: { id: 1 } }),
    ["ordinary"],
  ]
  for (const key of keys) queryClient.setQueryData(key, "cached")
  await trpc.blog.get.invalidate()
  expect(queryClient.getQueryState(keys[0]!)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(keys[1]!)?.isInvalidated).toBe(true)
  expect(queryClient.getQueryState(trpc.date.queryKey())?.isInvalidated).toBe(false)
  await trpc.blog.invalidate()
  await trpc.invalidate()
  expect(queryClient.getQueryState(trpc.date.queryKey())?.isInvalidated).toBe(true)
  expect(
    queryClient.getQueryState(orpc.blog.get.queryKey({ input: { id: 1 } }))?.isInvalidated,
  ).toBe(false)
  expect(queryClient.getQueryState(["ordinary"])?.isInvalidated).toBe(false)
  await orpc.invalidate()
  expect(queryClient.getQueryState(["ordinary"])?.isInvalidated).toBe(false)
})
