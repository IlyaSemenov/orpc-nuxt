import { afterEach, describe, expect, test } from "bun:test"

import { type Client, createORPCClient, ORPCError } from "@orpc/client"
import { createRouterClient, os } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient } from "@tanstack/vue-query"
import { createORPCVueQuery } from "orpc-vue"
import { type EffectScope, effectScope, ref } from "vue"
import * as z from "zod"

const clients: QueryClient[] = []
const scopes: EffectScope[] = []

/** Create an isolated cache and effect scope, both disposed by afterEach. */
function setup() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
    },
  })
  const scope = effectScope()
  clients.push(queryClient)
  scopes.push(scope)
  const router = {
    item: {
      get: os
        .input(
          z.object({
            id: z.number(),
          }),
        )
        .handler(({ input }) => {
          return {
            id: input.id,
            details: { title: `item ${input.id}` },
          }
        }),
      save: os
        .input(
          z.object({
            title: z.string(),
          }),
        )
        .handler(({ input }) => {
          return { saved: input.title }
        }),
    },
    ping: os.handler(() => "pong"),
    fail: os.handler(() => {
      throw new ORPCError("NOT_FOUND", { message: "Missing" })
    }),
    missing: os.errors({ NOT_FOUND: {} }).handler(({ errors }) => {
      throw errors.NOT_FOUND()
    }),
    // Exercise collisions with both upstream utility names and the added composable names.
    queryOptions: { nested: os.handler(() => "collision") },
    useQuery: { nested: os.handler(() => "query namespace") },
    useMutation: os.handler(() => "mutation name"),
    invalidate: { nested: os.handler(() => "invalidation namespace") },
  }
  const rawClient = createRouterClient(router)
  const orpc = createORPCVueQuery(rawClient, { queryClient })
  return {
    queryClient,
    scope,
    orpc,
    rawClient,
  }
}

afterEach(() => {
  for (const scope of scopes.splice(0)) scope.stop()
  for (const client of clients.splice(0)) client.clear()
})

describe("query and mutation client", () => {
  test("procedure invalidation covers every input; namespace invalidation includes descendants", async () => {
    const { orpc, queryClient } = setup()
    const keys = [
      orpc.item.get.queryKey({ input: { id: 1 } }),
      orpc.item.get.queryKey({ input: { id: 2 } }),
      orpc.item.save.queryKey({ input: { title: "draft" } }),
      orpc.ping.queryKey(),
    ]
    for (const key of keys) queryClient.setQueryData(key, "cached")

    await orpc.item.get.invalidate()
    expect(keys.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
      false,
      false,
    ])
    await orpc.item.invalidate()
    expect(keys.map((key) => queryClient.getQueryState(key)?.isInvalidated)).toEqual([
      true,
      true,
      true,
      false,
    ])
    await orpc.invalidate()
    expect(queryClient.getQueryState(keys[3]!)?.isInvalidated).toBe(true)
    expect(await orpc.invalidate.nested.call()).toBe("invalidation namespace")
  })

  test("invalidation keeps clients with different prefixes separate", async () => {
    const { rawClient, queryClient } = setup()
    const blog = createORPCVueQuery(rawClient, { queryClient, prefix: "blog" })
    const archive = createORPCVueQuery(rawClient, { queryClient, prefix: "archive" })
    const blogKey = blog.item.get.queryKey({ input: { id: 1 } })
    const archiveKey = archive.item.get.queryKey({ input: { id: 1 } })
    queryClient.setQueryData(blogKey, { id: 1, details: { title: "current" } })
    queryClient.setQueryData(archiveKey, { id: 1, details: { title: "archived" } })
    await blog.item.invalidate()
    expect(queryClient.getQueryState(blogKey)?.isInvalidated).toBe(true)
    expect(queryClient.getQueryState(archiveKey)?.isInvalidated).toBe(false)
  })

  test("preserves upstream utilities, procedure names and direct calls", async () => {
    const { orpc, rawClient, scope } = setup()
    const utils = createTanstackQueryUtils(rawClient)
    expect(orpc.item).toBe(orpc.item)
    expect(orpc.item.get.useQuery).toBe(orpc.item.get.useQuery)
    expect(orpc.item.get.useMutation).toBe(orpc.item.get.useMutation)
    expect(orpc.useQuery.nested).toBe(orpc.useQuery.nested)
    const key = orpc.item.get.queryKey({ input: { id: 1 } })
    const upstreamKey = utils.item.get.queryKey({ input: { id: 1 } })
    expect(key).toEqual(upstreamKey)
    expect(orpc.item.key()).toEqual(utils.item.key())
    expect(await orpc.ping.call()).toBe("pong")
    // Recursive property lookup must not manufacture a then method and hang promise resolution.
    expect(await orpc).toBe(orpc)
    const upstreamCollision = scope.run(() => {
      return orpc.queryOptions.nested.useQuery()
    })!
    expect(await upstreamCollision).toHaveProperty("data.value", "collision")
    const composableCollision = scope.run(() => {
      return orpc.useQuery.nested.useQuery()
    })!
    expect(await composableCollision).toHaveProperty("data.value", "query namespace")
    expect(await orpc.useMutation.call()).toBe("mutation name")
  })

  test("composables use official keys and resolve reactive client context", async () => {
    const { queryClient, scope } = setup()
    const calls: unknown[] = []
    const raw = createORPCClient<{
      get: Client<{ token: string }, { id: number }, string, Error>
      save: Client<{ token: string }, { title: string }, string, Error>
    }>({
      async call(path, input, options) {
        calls.push({ path, token: options.context.token })
        return `${path.join(".")} ${JSON.stringify(input)}`
      },
    })
    const orpc = createORPCVueQuery(raw, { queryClient })
    const token = ref("first")
    const context = () => ({ token: token.value })
    const query = await scope.run(() => orpc.get.useQuery({ id: 1 }, { context }))!
    expect(query.data.value).toBe('get {"id":1}')
    expect(queryClient.getQueryData(orpc.get.queryKey({ input: { id: 1 } }))).toBe('get {"id":1}')
    token.value = "second"
    const mutation = scope.run(() => orpc.save.useMutation({ context }))!
    expect(await mutation.mutateAsync({ title: "draft" })).toBe('save {"title":"draft"}')
    expect(calls).toEqual([
      { path: ["get"], token: "first" },
      { path: ["save"], token: "second" },
    ])
  })

  test("disposing one observer keeps the other alive; disposing the last aborts the request", async () => {
    const { queryClient, scope } = setup()
    let signal: AbortSignal | undefined
    const raw = createORPCClient<{
      pending: Client<object, void, string, Error>
    }>({
      call(_path, _input, options) {
        signal = options.signal
        // Keep the shared request pending so observer disposal is its only completion path.
        return new Promise((_resolve, reject) => {
          options.signal?.addEventListener("abort", () => reject(options.signal?.reason), {
            once: true,
          })
        })
      },
    })
    const orpc = createORPCVueQuery(raw, { queryClient })
    const otherScope = effectScope()
    scopes.push(otherScope)
    scope.run(() => {
      orpc.pending.useQuery()
    })
    otherScope.run(() => {
      orpc.pending.useQuery()
    })
    await Promise.resolve()
    scope.stop()
    expect(signal?.aborted).toBe(false)
    otherScope.stop()
    expect(signal?.aborted).toBe(true)
  })
})

describe("callCatching", () => {
  test("returns the output or the matching declared error result", async () => {
    const { orpc } = setup()
    expect(await orpc.item.get.callCatching({ id: 1 }, {})).toHaveProperty("id", 1)
    expect(await orpc.missing.callCatching(undefined, { NOT_FOUND: null })).toBeNull()
    expect(await orpc.missing.callCatching(undefined, { NOT_FOUND: (error) => error.code })).toBe(
      "NOT_FOUND",
    )
  })

  test("rethrows undeclared errors", async () => {
    const { orpc } = setup()
    await expect(orpc.fail.callCatching(undefined, {})).rejects.toBeInstanceOf(ORPCError)
  })

  test("forwards input and call options", async () => {
    const { queryClient } = setup()
    const calls: unknown[] = []
    const raw = createORPCClient<{
      get: Client<{ token: string }, { id: number }, string, Error>
    }>({
      async call(path, input, options) {
        calls.push({ path, input, context: options.context })
        return "result"
      },
    })
    const orpc = createORPCVueQuery(raw, { queryClient })
    const result = await orpc.get.callCatching({ id: 1 }, {}, { context: { token: "token" } })
    expect(result).toBe("result")
    expect(calls).toEqual([{ path: ["get"], input: { id: 1 }, context: { token: "token" } }])
  })
})
