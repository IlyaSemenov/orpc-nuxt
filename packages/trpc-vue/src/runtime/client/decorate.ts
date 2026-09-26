// Public procedure signatures live in types.ts; the decorator only dispatches calls and properties.
type Methods = Record<string, (...args: never[]) => unknown>

/**
 * Lazily expose methods at each tRPC router path without requiring the server router at runtime.
 * Cache property results so node and method identities stay stable.
 * Method calls and nested router paths can share a name, such as client.useQuery.nested.
 * Preserve root symbols so getUntypedClient() can still recover the native client.
 */
export function decorateClient(client: object, createMethods: (path: string[]) => Methods): object {
  function node(path: string[]): object {
    const methods = createMethods(path)
    const children = new Map<string, unknown>()

    return new Proxy(Object.create(null), {
      get(_target, property) {
        if (typeof property !== "string")
          return path.length === 0 ? Reflect.get(client, property) : undefined
        // Promise resolution must not manufacture a callable then method.
        if (property === "then") return undefined
        if (!children.has(property)) {
          const child = node([...path, property])
          const method = Object.hasOwn(methods, property) ? methods[property]! : undefined
          children.set(
            property,
            method
              ? new Proxy(method, {
                  // Keep ordinary Function helpers: tRPC 11.19's recursive proxy treats bind
                  // as an RPC path and only forwards the first argument through call.
                  get: (target, name, receiver) =>
                    typeof name !== "string" ||
                    ["call", "apply", "bind", "name", "length"].includes(name)
                      ? Reflect.get(target, name, receiver)
                      : Reflect.get(child, name),
                })
              : child,
          )
        }
        return children.get(property)
      },
    })
  }

  return node([])
}
