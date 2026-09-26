import type { AnyNestedClient, Client, ClientContext } from "@orpc/client"
import type { RouterUtils } from "@orpc/tanstack-query"
import type { MutationComposable, ReactiveMutationOptions } from "@rpc-vue/core/vue-query/mutation"
import type { QueryComposable, ReactiveQueryOptions } from "@rpc-vue/core/vue-query/query"
import type { MaybeRefOrGetter } from "vue"

import type { CallCatching } from "./client/error"

export type {
  AwaitableQuery,
  QueryResult as ORPCQueryResult,
  SelectedQueryResult as ORPCSelectedQueryResult,
} from "@rpc-vue/core/vue-query/query"
export type { ClientOptions as ORPCVueQueryOptions } from "@rpc-vue/core/vue-query/types"

/**
 * An oRPC client decorated with Vue composables and the official TanStack Query utilities.
 * Router branches retain their names; finite procedures gain query and mutation composables
 * and `callCatching()`.
 * Procedures whose output includes an async iterable retain only the upstream utilities.
 */
export type ORPCVueQueryClient<TClient extends AnyNestedClient> = RouterUtils<TClient> & {
  /** Invalidate all inputs of this procedure, or every query under this router branch. */
  invalidate: () => Promise<void>
} & (TClient extends Client<infer TClientContext, infer TInput, infer TOutput, infer TError>
    ? Extract<TOutput, AsyncIterable<unknown>> extends never
      ? ProcedureHooks<TClientContext, TInput, TOutput, TError>
      : object
    : {
        [TKey in keyof TClient]: TClient[TKey] extends AnyNestedClient
          ? ORPCVueQueryClient<TClient[TKey]>
          : never
      })

/** Keep context mandatory when the wrapped client requires fields the caller must supply. */
type ContextOptions<TClientContext extends ClientContext> = object extends TClientContext
  ? { context?: MaybeRefOrGetter<TClientContext> }
  : { context: MaybeRefOrGetter<TClientContext> }

/**
 * Reactive Vue Query options with the procedure's oRPC client context.
 * The useQuery overloads add mutually exclusive select and clone options.
 */
export type ORPCQueryOptions<
  TClientContext extends ClientContext,
  TOutput,
  TError,
  TSelected = TOutput,
> = ReactiveQueryOptions<TOutput, TError, TSelected> & ContextOptions<TClientContext>

/** Reactive Vue Query mutation options with the procedure's oRPC client context. */
export type ORPCMutationOptions<
  TClientContext extends ClientContext,
  TInput,
  TOutput,
  TError,
  TOnMutateResult = unknown,
> = ReactiveMutationOptions<TInput, TOutput, TError, TOnMutateResult> &
  ContextOptions<TClientContext>

/** Require options whenever the wrapped client requires context fields. */
type ContextRequired<TClientContext extends ClientContext> = object extends TClientContext
  ? false
  : true

/** Carry each procedure's input, output, error and context types through the runtime decorator. */
interface ProcedureHooks<TClientContext extends ClientContext, TInput, TOutput, TError>
  extends
    QueryComposable<
      TInput,
      TOutput,
      TError,
      ContextOptions<TClientContext>,
      ContextRequired<TClientContext>
    >,
    MutationComposable<
      TInput,
      TOutput,
      TError,
      ContextOptions<TClientContext>,
      ContextRequired<TClientContext>
    >,
    CallCatching<TClientContext, TInput, TOutput, TError> {}
