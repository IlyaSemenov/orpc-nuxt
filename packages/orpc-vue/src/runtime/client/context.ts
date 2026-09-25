import type { AnyNestedClient } from "@orpc/client"
import { hasInjectionContext, inject, type InjectionKey } from "vue"

import type { ORPCVueQueryClient } from "../types"

/**
 * Create a Vue injection key and a typed accessor for a decorated oRPC client.
 * The context holds no client, so each Vue app or SSR request provides its own instance.
 * Call the accessor during component setup or inside an active Vue injection context.
 *
 * @returns A key for `app.provide()` and a composable that reads the provided client.
 */
export function createORPCVueContext<T extends AnyNestedClient>() {
  const key: InjectionKey<ORPCVueQueryClient<T>> = Symbol("orpc-vue")

  return {
    key,
    useOrpc(): ORPCVueQueryClient<T> {
      const client = hasInjectionContext() ? inject(key, undefined) : undefined
      if (!client) {
        throw new Error(
          "No oRPC client was provided. Call app.provide(context.key, orpc) before using context.useOrpc().",
        )
      }
      return client
    },
  }
}
