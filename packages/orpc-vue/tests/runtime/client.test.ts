import { afterEach, describe, expect, test } from "bun:test"

import { type Client, createORPCClient, ORPCError } from "@orpc/client"
import { createRouterClient, os } from "@orpc/server"
import { createTanstackQueryUtils } from "@orpc/tanstack-query"
import { QueryClient, skipToken, VueQueryPlugin } from "@tanstack/vue-query"
import { renderToString } from "@vue/server-renderer"
import { createORPCVueQuery } from "orpc-vue"
import {
  createSSRApp,
  type EffectScope,
  effectScope,
  h,
  isReadonly,
  nextTick,
  reactive,
  ref,
} from "vue"
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
  let calls = 0
  const router = {
    item: {
      get: os
        .input(
          z.object({
            id: z.number(),
          }),
        )
        .handler(({ input }) => {
          calls++
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
    calls: () => calls,
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

  test("captures an injected client for invalidation after the plugin context has ended", async () => {
    const { rawClient, queryClient } = setup()
    const app = createSSRApp({ render: () => null })
    app.use(VueQueryPlugin, { queryClient })
    const orpc = app.runWithContext(() => createORPCVueQuery(rawClient))
    const key = orpc.item.get.queryKey({ input: { id: 1 } })
    queryClient.setQueryData(key, { id: 1, details: { title: "cached" } })
    await orpc.item.invalidate()
    expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true)
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

  test("returns state immediately and deduplicates the initial fetch", async () => {
    const { orpc, scope, calls } = setup()
    const first = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 })
    })!
    const second = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 })
    })!
    expect(first.data.value).toBeUndefined()
    expect(first.isPending.value).toBe(true)
    const result = await first
    await second
    expect(result.data).toBe(first.data)
    expect(first.data.value?.id).toBe(1)
    expect(second.data.value?.id).toBe(1)
    expect(isReadonly(first.data.value)).toBe(true)
    expect(calls()).toBe(1)
  })

  test("clones are local; root assignment updates the shared cache", async () => {
    const { orpc, scope, queryClient } = setup()
    const clone = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 }, { clone: true })
    })!
    const other = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 })
    })!
    await Promise.all([clone, other])
    clone.data.value!.details.title = "local edit"
    expect(other.data.value?.details.title).toBe("item 1")
    const replacement = {
      id: 1,
      details: { title: "saved" },
    }
    clone.data.value = replacement
    expect(other.data.value?.details.title).toBe("saved")
    const key = orpc.item.get.queryKey({ input: { id: 1 } })
    const cached = queryClient.getQueryData(key)
    expect(clone.data.value).not.toBe(cached)
    clone.data.value!.details.title = "another local edit"
    expect(other.data.value?.details.title).toBe("saved")
    await nextTick()
    expect(clone.data.value?.details.title).toBe("another local edit")
    // Once an assignment has propagated, further local edits survive unrelated Vue ticks.
    clone.data.value!.details.title = "draft"
    await nextTick()
    expect(clone.data.value?.details.title).toBe("draft")
    await clone.invalidate()
    expect(clone.data.value?.details.title).toBe("item 1")
  })

  test("a cache write resets a clone even when the data is structurally unchanged", async () => {
    const { orpc, scope, queryClient } = setup()
    const query = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 }, { clone: true })
    })!
    await query
    query.data.value!.details.title = "draft"
    const key = orpc.item.get.queryKey({ input: { id: 1 } })
    queryClient.setQueryData(key, {
      id: 1,
      details: { title: "item 1" },
    })
    expect(query.data.value?.details.title).toBe("item 1")
  })

  test("select changes the view and makes assignments fail without changing the cache", async () => {
    const { orpc, scope, queryClient } = setup()
    const selected = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 }, { select: (item) => item.details })
    })!
    await selected
    expect(selected.data.value).toEqual({ title: "item 1" })
    expect(isReadonly(selected.data.value)).toBe(true)
    expect(() => {
      Reflect.set(selected.data, "value", { title: "wrong" })
    }).toThrow("readonly")
    const key = orpc.item.get.queryKey({ input: { id: 1 } })
    const cached = queryClient.getQueryData(key)
    expect(cached).toHaveProperty("id", 1)
    expect(() => {
      scope.run(() => {
        // @ts-expect-error JavaScript callers also receive a useful error.
        orpc.item.get.useQuery({ id: 1 }, { clone: true, select: (item) => item.id })
      })
    }).toThrow("cannot be combined")
  })

  test("disabled and skipped queries settle without making a request", async () => {
    const { orpc, scope, calls } = setup()
    const enabled = ref(false)
    const query = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 }, { enabled })
    })!
    const skipped = scope.run(() => {
      return orpc.item.get.useQuery(skipToken)
    })!
    await Promise.all([query, skipped])
    expect(calls()).toBe(0)
    enabled.value = true
    await nextTick()
    await query.suspense()
    expect(query.data.value?.id).toBe(1)
    expect(calls()).toBe(1)
  })

  test("inherits QueryClient enabled defaults", async () => {
    const { orpc, scope, queryClient, calls } = setup()
    queryClient.setDefaultOptions({
      queries: { enabled: false },
    })
    const query = scope.run(() => {
      return orpc.item.get.useQuery({ id: 1 })
    })!
    await query
    expect(calls()).toBe(0)
  })

  test("reactive input gets separate cache entries and root writes use the current key", async () => {
    const { orpc, scope, queryClient } = setup()
    const input = reactive({ id: 1 })
    const query = scope.run(() => {
      return orpc.item.get.useQuery(input, { clone: true })
    })!
    await query
    input.id = 2
    await nextTick()
    await query.suspense()
    query.data.value = {
      id: 2,
      details: { title: "updated" },
    }
    const firstKey = orpc.item.get.queryKey({ input: { id: 1 } })
    const secondKey = orpc.item.get.queryKey({ input: { id: 2 } })
    const firstCached = queryClient.getQueryData(firstKey)
    const secondCached = queryClient.getQueryData(secondKey)
    expect(firstCached).toHaveProperty("id", 1)
    expect(secondCached).toHaveProperty("details.title", "updated")
  })

  test("errors are state by default", async () => {
    const { orpc, scope } = setup()
    const query = scope.run(() => {
      return orpc.fail.useQuery()
    })!
    await query
    expect(query.error.value).toHaveProperty("code", "NOT_FOUND")
  })

  test("throwOnError rejects awaiting and reaches the Vue error handler", async () => {
    const { orpc } = setup()
    const errors: unknown[] = []
    const app = createSSRApp({
      async setup() {
        const query = orpc.fail.useQuery(undefined, { throwOnError: true })
        await expect(query).rejects.toHaveProperty("code", "NOT_FOUND")
        return () => h("p", "handled")
      },
    })
    app.config.errorHandler = (error) => {
      errors.push(error)
    }
    expect(await renderToString(app)).toContain("handled")
    expect(errors.length).toBeGreaterThan(0)
  })

  test("mutations preserve input, output and callbacks", async () => {
    const { orpc, scope } = setup()
    const successes: string[] = []
    const mutation = scope.run(() => {
      return orpc.item.save.useMutation({
        onSuccess: (data) => {
          successes.push(data.saved)
        },
      })
    })!
    const result = await mutation.mutateAsync({ title: "saved" })
    expect(result).toEqual({
      saved: "saved",
    })
    expect(successes).toEqual(["saved"])
    expect(mutation.data.value).toEqual({ saved: "saved" })
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
