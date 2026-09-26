import { QueryClient } from "@tanstack/vue-query"
import { type Mock, vi } from "vitest"

type Handler = (input: unknown, options: unknown) => unknown

/** The isolated client, procedure registry and cleanup function created for a test suite. */
export interface TestClient<TClient, TProcedures> {
  /** The decorated client to provide to a component or return from a mocked client composable. */
  client: TClient
  /** Register typed implementations and receive Vitest mocks for call assertions. */
  procedures: TProcedures
  /** The cache the client reads and writes, to seed or inspect from a test. */
  queryClient: QueryClient
  /** Remove every registered procedure implementation and clear the query cache. */
  reset: () => void
}

/**
 * Create the handler registry and cache behind an adapter's test client.
 * `procedures` is a router-shaped tree built lazily from property access, because the client has
 * no router at runtime; calling `.handle(handler)` on a path registers that procedure's handler.
 *
 * @param protocol - Names the protocol in error messages, such as oRPC or tRPC.
 * @param queryClient - A cache to use instead of an owned one that never retries.
 * @param createHandlerOptions - Build the second handler argument for each registration.
 */
export function createTestRegistry(
  protocol: string,
  queryClient = new QueryClient({
    // Retries turn a failing procedure into a test timeout instead of a reported failure.
    defaultOptions: { queries: { retry: false } },
  }),
  createHandlerOptions: () => unknown = () => undefined,
) {
  const handlers = new Map<string, Mock<(input: unknown) => unknown>>()

  function node(path: string[]): unknown {
    const children = new Map<string, unknown>()
    return new Proxy(
      (handler: Handler) => {
        if (path.at(-1) !== "handle" || typeof handler !== "function") {
          throw new TypeError(
            `Register a ${protocol} test handler with procedure.handle(function).`,
          )
        }
        const options = createHandlerOptions()
        // Keep the public mock's call tuples limited to procedure input while the handler gets options.
        const mock = vi.fn((input: unknown) => handler(input, options))
        handlers.set(path.slice(0, -1).join("."), mock)
        return mock
      },
      {
        get(target, property, receiver) {
          // Promise resolution and reflection must not create synthetic router paths.
          if (typeof property !== "string" || property === "then") {
            return Reflect.get(target, property, receiver)
          }
          if (!children.has(property)) children.set(property, node([...path, property]))
          return children.get(property)
        },
      },
    )
  }

  return {
    procedures: node([]),
    queryClient,
    /** Run the handler registered for a dot-separated procedure path. */
    call(path: string, input: unknown) {
      const handler = handlers.get(path)
      if (!handler) {
        throw new Error(`No test handler is registered for ${protocol} procedure "${path}"`)
      }
      return handler(input)
    },
    /** Remove every registered handler and clear the cache. */
    reset() {
      handlers.clear()
      queryClient.clear()
    },
  }
}
