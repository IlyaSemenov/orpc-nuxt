import type { ClientContext } from "@orpc/client"
import type { ProcedureUtils } from "@orpc/tanstack-query"
import { type QueryClient, useMutation } from "@tanstack/vue-query"
import { computed, getCurrentScope, type MaybeRefOrGetter, toValue } from "vue"

import type { ORPCMutationOptions } from "../types"

type RuntimeOptions = ORPCMutationOptions<ClientContext, unknown, unknown, Error>
type RuntimeProcedure = ProcedureUtils<ClientContext, unknown, unknown, Error>

/**
 * Create a Vue Query mutation observer for one oRPC procedure in the active effect scope.
 * Reactive options and client context are resolved before building the official mutation options.
 * Vue Query owns execution, callbacks and observer disposal.
 *
 * @param target - The procedure's upstream TanStack utilities, supplied by the client decorator.
 * @param options - Mutation options, optionally wrapped in a ref or getter.
 * @param queryClient - The cache owner resolved by the client factory.
 */
export function useORPCMutation(target: object, options: unknown, queryClient: QueryClient) {
  if (!getCurrentScope()) {
    throw new Error("useMutation() requires a component setup or an active Vue effect scope.")
  }
  const procedure = target as RuntimeProcedure
  return useMutation(
    computed(() => {
      const { context, ...rest } =
        toValue(options as MaybeRefOrGetter<RuntimeOptions | undefined>) ?? {}
      return procedure.mutationOptions({
        ...rest,
        context: toValue(context),
      } as Parameters<RuntimeProcedure["mutationOptions"]>[0])
    }),
    queryClient,
  )
}
