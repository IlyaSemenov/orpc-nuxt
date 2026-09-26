import type { AnyNestedClient } from "@orpc/client"
import { createClientContext } from "@rpc-vue/core/vue/context"

import type { ORPCVueQueryClient } from "../types"

/**
 * Create a Vue injection key and a typed accessor for a decorated oRPC client.
 * The context holds no client, so each Vue app or SSR request provides its own instance.
 * Call the accessor during component setup or inside an active Vue injection context.
 *
 * @returns A key for `app.provide()` and a composable that reads the provided client.
 */
export function createORPCVueContext<TClient extends AnyNestedClient>() {
  const { key, useRpc } = createClientContext<ORPCVueQueryClient<TClient>>("oRPC", "useOrpc")
  return { key, useOrpc: useRpc }
}
