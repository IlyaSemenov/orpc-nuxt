import type { AnyNestedClient, Client, ClientLink, InferClientContext } from "@orpc/client"
import { createORPCClient } from "@orpc/client"
import { QueryClient } from "@tanstack/vue-query"
import type { Mock } from "vitest"
import { vi } from "vitest"

import { createORPCNuxtClient } from "./client/create"
import type { ORPCNuxtClient, ORPCNuxtClientOptions } from "./types"

type MaybePromise<T> = T | Promise<T>
type RuntimeHandler = (input: unknown) => unknown

/** A procedure implementation registered for a test client. */
export type TestORPCHandler<TProcedure> =
  TProcedure extends Client<infer _Context, infer Input, infer Output, infer _Error>
    ? (input: Input) => MaybePromise<Awaited<Output>>
    : never

/** Registration methods for one procedure in a test client. */
export interface TestORPCProcedure<TProcedure> {
  /** Register the implementation used by subsequent calls and return its Vitest mock. */
  handle(handler: TestORPCHandler<TProcedure>): Mock<TestORPCHandler<TProcedure>>
}

/** A router-shaped tree whose procedure leaves register test implementations. */
export type TestORPCProcedures<T extends AnyNestedClient> =
  T extends Client<infer Context, infer Input, infer Output, infer Error>
    ? TestORPCProcedure<Client<Context, Input, Output, Error>>
    : {
        [Key in keyof T]: T[Key] extends AnyNestedClient ? TestORPCProcedures<T[Key]> : never
      }

/** The isolated client, procedure registry and cleanup function created for a test suite. */
export interface TestORPCClient<T extends AnyNestedClient> {
  /** The decorated client to return from a mocked `useOrpc()`. */
  client: ORPCNuxtClient<T>
  /** Register typed implementations and receive Vitest mocks for call assertions. */
  procedures: TestORPCProcedures<T>
  /** The cache the client reads and writes, to seed or inspect from a test. */
  queryClient: QueryClient
  /** Remove every registered procedure implementation and clear the query cache. */
  reset: () => void
}

/**
 * Create an isolated fake oRPC client for Nuxt component tests.
 * The entrypoint has no Nuxt runtime dependency.
 * A shared setup file can therefore import it when Vitest hoists `mockNuxtImport()`.
 *
 * Without a `queryClient` the client owns one that never retries, so a failing procedure fails
 * the test instead of retrying until it times out.
 *
 * @param options - Cache key prefix and a QueryClient to use instead of the owned one.
 * @returns A decorated client, its typed registration tree, its cache and a reset function.
 */
export function createTestORPCClient<T extends AnyNestedClient>(
  options: ORPCNuxtClientOptions = {},
): TestORPCClient<T> {
  const registrations = new Map<string, Mock<RuntimeHandler>>()
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        // Retries turn a failing procedure into a test timeout instead of a reported failure.
        queries: { retry: false },
      },
    })

  /** Register one handler without sharing state with another factory instance. */
  function registerHandler(path: string, handler: RuntimeHandler) {
    const mock = vi.fn(handler)
    registrations.set(path, mock)
    return mock
  }

  /** Dispatch a client call to the handler registered for its complete router path. */
  async function callHandler(path: string, input: unknown) {
    const handler = registrations.get(path)
    if (!handler) {
      throw new Error(`No test handler is registered for oRPC procedure "${path}"`)
    }
    return await handler(input)
  }

  const link: ClientLink<InferClientContext<T>> = {
    async call(path, input) {
      return await callHandler(path.join("."), input)
    },
  }
  const client = createORPCNuxtClient(createORPCClient<T>(link), { ...options, queryClient })
  const procedures = createRecursiveProxy([], (path, args) => {
    if (path.at(-1) !== "handle") {
      throw new Error(`Unknown test procedure call: ${path.join(".")}`)
    }
    const handler = args[0]
    if (typeof handler !== "function") {
      throw new TypeError(
        `A test handler must be a function for oRPC procedure "${path.slice(0, -1).join(".")}"`,
      )
    }
    return registerHandler(path.slice(0, -1).join("."), handler as RuntimeHandler)
  }) as TestORPCProcedures<T>

  return {
    client,
    procedures,
    queryClient,
    reset: () => {
      registrations.clear()
      queryClient.clear()
    },
  }
}

/** Build the registration tree lazily because an oRPC client does not expose router keys. */
function createRecursiveProxy(
  path: string[],
  call: (path: string[], args: unknown[]) => unknown,
): unknown {
  const target = () => {}
  const children = new Map<string, unknown>()

  return new Proxy(target, {
    get(_, property, receiver) {
      // Promise resolution and reflection must not create synthetic router paths.
      if (typeof property !== "string" || property === "then") {
        return Reflect.get(target, property, receiver)
      }
      if (children.has(property)) return children.get(property)

      const child = createRecursiveProxy([...path, property], call)
      children.set(property, child)
      return child
    },
    apply(_, __, args) {
      return call(path, args)
    },
  })
}
