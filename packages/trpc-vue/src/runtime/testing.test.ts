import { describe, expect, test } from "bun:test"

import { TRPCClientError } from "@trpc/client"
import { initTRPC } from "@trpc/server"
import * as z from "zod"

import { createTestTRPCClient } from "./testing"

const t = initTRPC.create()
const router = t.router({
  blog: t.router({
    posts: t.router({
      list: t.procedure.query(() => [{ id: 1, title: "First post" }]),
      update: t.procedure
        .input(z.object({ id: z.number(), title: z.string() }))
        .mutation(({ input }) => input),
      events: t.procedure.subscription(async function* () {
        yield "event"
      }),
    }),
  }),
})

function setup() {
  return createTestTRPCClient<typeof router>()
}

describe("createTestTRPCClient()", () => {
  test("dispatches typed handlers and exposes decorated client methods", async () => {
    const { client, procedures } = setup()
    const list = procedures.blog.posts.list.handle(() => [{ id: 1, title: "First post" }])

    expect(await client.blog.posts.list.query()).toEqual([{ id: 1, title: "First post" }])
    expect(list.mock.calls).toEqual([[undefined]])
    expect(typeof client.blog.posts.list.useQuery).toBe("function")
    expect(typeof client.blog.posts.update.useMutation).toBe("function")
    expect(typeof client.blog.posts.invalidate).toBe("function")
  })

  test("reports the full path of an unregistered procedure", async () => {
    const { client } = setup()

    await expect(client.blog.posts.update.mutate({ id: 1, title: "Updated" })).rejects.toThrow(
      'No test handler is registered for tRPC procedure "blog.posts.update"',
    )
  })

  test("preserves a TRPCClientError thrown by a handler", async () => {
    const { client, procedures } = setup()
    const error = new TRPCClientError("Missing post")
    procedures.blog.posts.list.handle(() => {
      throw error
    })

    await expect(client.blog.posts.list.query()).rejects.toBe(error)
  })

  test("rejects subscriptions instead of mocking them", async () => {
    const { client } = setup()

    await expect(
      new Promise((resolve, reject) => {
        client.blog.posts.events.subscribe(undefined, { onData: resolve, onError: reject })
      }),
    ).rejects.toThrow("does not mock subscriptions")
  })
})
