import { describe, expect, test } from "bun:test"

import { type Client, ORPCError } from "@orpc/client"
import { QueryClient } from "@tanstack/vue-query"

import { catchORPCError } from "./client/error"
import { createTestORPCClient } from "./testing"

interface Post {
  id: number
  title: string
}

type AppClient = {
  blog: {
    posts: {
      list: Client<Record<never, never>, undefined, Post[], unknown>
      update: Client<
        Record<never, never>,
        { id: number; title: string },
        Post,
        ORPCError<"CONFLICT", { field: string }> | Error
      >
      fail: Client<Record<never, never>, undefined, never, unknown>
    }
  }
}

function setup() {
  return createTestORPCClient<AppClient>()
}

describe("test oRPC client", () => {
  test("dispatches typed handlers and exposes decorated client methods", async () => {
    const { client, procedures } = setup()
    const list = procedures.blog.posts.list.handle(() => [{ id: 1, title: "First post" }])

    expect(await client.blog.posts.list.call()).toEqual([{ id: 1, title: "First post" }])
    expect(list.mock.calls).toEqual([[undefined]])
    expect(typeof client.blog.posts.list.useQuery).toBe("function")
    expect(typeof client.blog.posts.update.useMutation).toBe("function")
    expect(typeof client.blog.posts.invalidate).toBe("function")
    expect(procedures.blog.posts).toBe(procedures.blog.posts)
    expect(Reflect.get(procedures, Symbol.iterator)).toBeUndefined()
  })

  test("reports the full path of an unregistered procedure", async () => {
    const { client } = setup()

    await expect(client.blog.posts.update.call({ id: 1, title: "Updated" })).rejects.toThrow(
      'No test handler is registered for oRPC procedure "blog.posts.update"',
    )
  })

  test("a later registration replaces the handler for the same path", async () => {
    const { client, procedures } = setup()
    const first = procedures.blog.posts.list.handle(() => [{ id: 1, title: "First" }])
    const replacement = procedures.blog.posts.list.handle(() => [{ id: 2, title: "Second" }])

    expect(await client.blog.posts.list.call()).toEqual([{ id: 2, title: "Second" }])
    expect(first.mock.calls).toHaveLength(0)
    expect(replacement.mock.calls).toHaveLength(1)
  })

  test("the owned cache reports a failing procedure instead of retrying it", () => {
    expect(setup().queryClient.getDefaultOptions().queries?.retry).toBe(false)
  })

  test("reset clears registrations and the cache without touching another client", async () => {
    const queryClient = new QueryClient()
    const own = createTestORPCClient<AppClient>({ queryClient })
    const other = setup()
    own.procedures.blog.posts.list.handle(() => [{ id: 1, title: "First" }])
    other.procedures.blog.posts.list.handle(() => [{ id: 2, title: "Second" }])
    queryClient.setQueryData(["cached"], "value")
    other.queryClient.setQueryData(["cached"], "value")

    own.reset()

    await expect(own.client.blog.posts.list.call()).rejects.toThrow("blog.posts.list")
    expect(queryClient.getQueryData(["cached"])).toBeUndefined()
    expect(await other.client.blog.posts.list.call()).toEqual([{ id: 2, title: "Second" }])
    expect(other.queryClient.getQueryData<string>(["cached"])).toBe("value")
  })

  test("preserves an ORPCError thrown by a handler", async () => {
    const { client, procedures } = setup()
    const error = new ORPCError("NOT_FOUND", { message: "Missing post" })
    procedures.blog.posts.fail.handle(() => {
      throw error
    })

    await expect(client.blog.posts.fail.call()).rejects.toBe(error)
  })

  test("creates a declared error handled by the client helper", async () => {
    const { client, procedures } = setup()
    const update = procedures.blog.posts.update.handle((input, { errors }) => {
      if (input.title === "Duplicate") {
        throw errors.CONFLICT({ message: "Already exists", data: { field: "title" } })
      }
      return { id: input.id, title: input.title }
    })

    await expect(
      catchORPCError(client.blog.posts.update.call({ id: 1, title: "Duplicate" }), {
        CONFLICT: (error) => error.data.field,
      }),
    ).resolves.toBe("title")
    expect(update.mock.calls).toEqual([[{ id: 1, title: "Duplicate" }]])
  })
})
