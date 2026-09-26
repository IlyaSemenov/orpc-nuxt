import type { ClientContext } from "@orpc/client"
import type { ProcedureUtils } from "@orpc/tanstack-query"
import type { MutationObserverOptions, QueryObserverOptions } from "@tanstack/vue-query"
import { toValue } from "vue"

type RuntimeProcedure = ProcedureUtils<ClientContext, unknown, unknown, Error>
type RuntimeQueryOptions = Parameters<RuntimeProcedure["queryOptions"]>[0]
type RuntimeMutationOptions = Parameters<RuntimeProcedure["mutationOptions"]>[0]

/**
 * Adapt one official oRPC utility node to the core's option builders.
 * The builders resolve reactive client context and keep the official keys and query functions.
 */
export function createProcedureOptions(target: object) {
  const procedure = target as RuntimeProcedure
  return {
    queryOptions(input: unknown, settings: Record<string, unknown>) {
      // Data tags carry compile-time procedure types; the core only handles runtime key values.
      return procedure.queryOptions({
        ...settings,
        input,
        context: toValue(settings.context),
      } as RuntimeQueryOptions) as unknown as QueryObserverOptions<unknown, Error>
    },
    mutationOptions(settings: Record<string, unknown>) {
      return procedure.mutationOptions({
        ...settings,
        context: toValue(settings.context),
      } as RuntimeMutationOptions) as MutationObserverOptions<unknown, Error, unknown>
    },
  }
}
