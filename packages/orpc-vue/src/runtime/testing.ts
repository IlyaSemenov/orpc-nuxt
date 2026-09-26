import type {
  AnyORPCError,
  AnyNestedClient,
  Client,
  ClientLink,
  InferClientContext,
} from "@orpc/client"
import { createORPCClient, createORPCErrorFromJson, ORPCError } from "@orpc/client"
import { QueryClient } from "@tanstack/vue-query"
import type { Mock } from "vitest"
import { vi } from "vitest"

import { createORPCVueQuery } from "./client/create"
import type { ORPCVueQueryClient, ORPCVueQueryOptions } from "./types"

type MaybePromise<T> = T | Promise<T>
type RuntimeHandlerOptions = {
  errors: Record<string, (options?: RuntimeErrorOptions) => AnyORPCError>
}
type RegisteredHandler = (input: unknown) => unknown
type RuntimeErrorOptions = ErrorOptions & { message?: string; data?: unknown }

type ProcedureError<TProcedure> =
  TProcedure extends Client<any, any, any, infer Error> ? Extract<Error, AnyORPCError> : never

type ErrorConstructorOptions<Data> = ErrorOptions & { message?: string } & (undefined extends Data
    ? { data?: Data }
    : { data: Data })

type ErrorConstructor<ErrorType extends AnyORPCError> =
  ErrorType extends ORPCError<infer _Code, infer Data>
    ? (
        ...args: undefined extends Data
          ? [options?: ErrorConstructorOptions<Data>]
          : [options: ErrorConstructorOptions<Data>]
      ) => ErrorType
    : never

type TestORPCErrors<TProcedure> = {
  [Code in ProcedureError<TProcedure>["code"] & string]: ErrorConstructor<
    Extract<ProcedureError<TProcedure>, { code: Code }>
  >
}

/** Error constructors derived from the procedure's declared error union. */
export interface TestORPCHandlerOptions<TProcedure> {
  /** Construct an error declared by this procedure, with its corresponding data type. */
  errors: TestORPCErrors<TProcedure>
}

/** A procedure implementation registered for a test client. */
export type TestORPCHandler<TProcedure> =
  TProcedure extends Client<infer _Context, infer Input, infer Output, infer _Error>
    ? (input: Input, options: TestORPCHandlerOptions<TProcedure>) => MaybePromise<Awaited<Output>>
    : never

type TestORPCMockHandler<TProcedure> =
  TProcedure extends Client<infer _Context, infer Input, infer Output, infer _Error>
    ? (input: Input) => MaybePromise<Awaited<Output>>
    : never

/** Registration methods for one procedure in a test client. */
export interface TestORPCProcedure<TProcedure> {
  /** Register the implementation used by subsequent calls and return its Vitest mock. */
  handle(handler: TestORPCHandler<TProcedure>): Mock<TestORPCMockHandler<TProcedure>>
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
  /** The decorated client to provide to a component or return from a mocked `useOrpc()`. */
  client: ORPCVueQueryClient<T>
  /** Register typed implementations and receive Vitest mocks for call assertions. */
  procedures: TestORPCProcedures<T>
  /** The cache the client reads and writes, to seed or inspect from a test. */
  queryClient: QueryClient
  /** Remove every registered procedure implementation and clear the query cache. */
  reset: () => void
}

/**
 * Create an isolated fake oRPC client for Vue or Nuxt component tests.
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
  options: ORPCVueQueryOptions = {},
): TestORPCClient<T> {
  const registrations = new Map<string, Mock<RegisteredHandler>>()
  const queryClient =
    options.queryClient ??
    new QueryClient({
      defaultOptions: {
        // Retries turn a failing procedure into a test timeout instead of a reported failure.
        queries: { retry: false },
      },
    })

  const link: ClientLink<InferClientContext<T>> = {
    async call(path, input) {
      const name = path.join(".")
      const handler = registrations.get(name)
      if (!handler) {
        throw new Error(`No test handler is registered for oRPC procedure "${name}"`)
      }
      return await handler(input)
    },
  }
  const client = createORPCVueQuery(createORPCClient<T>(link), { ...options, queryClient })
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
    const options = { errors: createErrorConstructors() }
    // Keep the public mock's call tuples limited to procedure input while the implementation gets helpers.
    const mock = vi.fn((input: unknown) => handler(input, options))
    registrations.set(path.slice(0, -1).join("."), mock)
    return mock
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

/** Create lazy error constructors without requiring the procedure's runtime contract. */
function createErrorConstructors(): RuntimeHandlerOptions["errors"] {
  return new Proxy(Object.create(null) as RuntimeHandlerOptions["errors"], {
    get(target, property, receiver) {
      if (typeof property !== "string") return Reflect.get(target, property, receiver)
      target[property] ??= (options?: RuntimeErrorOptions) => {
        const error = new ORPCError(property, options)
        return createORPCErrorFromJson({ ...error.toJSON(), defined: true }, { cause: error.cause })
      }
      return target[property]
    },
  })
}

/** Build the registration tree lazily because an oRPC client does not expose router keys. */
function createRecursiveProxy(
  path: string[],
  call: (path: string[], args: unknown[]) => unknown,
): unknown {
  const target = (...args: unknown[]) => call(path, args)
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
  })
}
