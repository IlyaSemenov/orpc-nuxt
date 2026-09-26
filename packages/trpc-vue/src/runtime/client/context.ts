import { createClientContext } from "@rpc-vue/core/vue/context"
import type { AnyTRPCRouter } from "@trpc/server"

import type { TRPCVueQueryClient } from "../types"

/**
 * Create a Vue injection key and a typed accessor for a decorated tRPC client.
 * The context holds no client, so each Vue app or SSR request provides its own instance.
 * Call the accessor during component setup or inside an active Vue injection context.
 *
 * @returns A key for `app.provide()` and a composable that reads the provided client.
 */
export function createTRPCVueContext<TRouter extends AnyTRPCRouter>() {
  const { key, useRpc } = createClientContext<TRPCVueQueryClient<TRouter>>("tRPC", "useTrpc")
  return { key, useTrpc: useRpc }
}
