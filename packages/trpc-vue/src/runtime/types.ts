import type { MutationComposable, ReactiveMutationOptions } from "@rpc-vue/core/vue-query/mutation"
import type { QueryComposable, ReactiveQueryOptions } from "@rpc-vue/core/vue-query/query"
import type { QueryKey } from "@tanstack/vue-query"
import type { TRPCClient, TRPCClientError } from "@trpc/client"
import type {
  AnyTRPCProcedure,
  AnyTRPCRouter,
  inferProcedureInput,
  inferProcedureOutput,
  inferTransformedProcedureOutput,
  TRPCRouterRecord,
} from "@trpc/server"

import type {
  InfiniteUtils,
  MutationRequestOptions,
  MutationUtils,
  QueryRequestOptions,
  QueryUtils,
} from "./client/utils"

export type {
  AwaitableQuery,
  QueryResult as TRPCQueryResult,
  SelectedQueryResult as TRPCSelectedQueryResult,
} from "@rpc-vue/core/vue-query/query"
export type { ClientOptions as TRPCVueQueryOptions } from "@rpc-vue/core/vue-query/types"

/**
 * Reactive Vue Query options with the procedure's tRPC request options.
 * The useQuery overloads add mutually exclusive select and clone options.
 */
export type TRPCQueryOptions<TOutput, TError, TSelected = TOutput> = ReactiveQueryOptions<
  TOutput,
  TError,
  TSelected
> &
  QueryRequestOptions

/** Reactive Vue Query mutation options with the procedure's tRPC request options. */
export type TRPCMutationOptions<
  TInput,
  TOutput,
  TError,
  TOnMutateResult = unknown,
> = ReactiveMutationOptions<TInput, TOutput, TError, TOnMutateResult> & MutationRequestOptions

interface PathUtils {
  /** Match this namespace and path, across all inputs and query kinds. */
  pathKey(): QueryKey
  /** Invalidate all queries under this namespace and path. */
  invalidate(): Promise<void>
}
interface QueryProcedure<TInput, TOutput, TError>
  extends
    PathUtils,
    QueryUtils<TInput, TOutput, TError>,
    QueryComposable<TInput, TOutput, TError, QueryRequestOptions> {}
interface MutationProcedure<TInput, TOutput, TError>
  extends
    MutationUtils<TInput, TOutput, TError>,
    MutationComposable<TInput, TOutput, TError, MutationRequestOptions> {}
type ProcedureUtils<
  TRouter extends AnyTRPCRouter,
  TProcedure extends AnyTRPCProcedure,
  TInput = inferProcedureInput<TProcedure>,
  TOutput = inferTransformedProcedureOutput<TRouter, TProcedure>,
  TError = TRPCClientError<TRouter>,
> =
  Extract<inferProcedureOutput<TProcedure>, AsyncIterable<unknown>> extends never
    ? TProcedure["_def"]["type"] extends "query"
      ? QueryProcedure<TInput, TOutput, TError> &
          (TInput extends { cursor?: unknown } ? InfiniteUtils<TInput, TOutput, TError> : object)
      : TProcedure["_def"]["type"] extends "mutation"
        ? MutationProcedure<TInput, TOutput, TError>
        : object
    : object

type DecoratedRecord<TRouter extends AnyTRPCRouter, Record extends TRPCRouterRecord> = PathUtils & {
  [TKey in keyof Record]: Record[TKey] extends AnyTRPCProcedure
    ? ProcedureUtils<TRouter, Record[TKey]>
    : Record[TKey] extends TRPCRouterRecord
      ? DecoratedRecord<TRouter, Record[TKey]>
      : never
}

/**
 * A tRPC client decorated with Vue composables and TanStack Query utilities.
 * Router branches retain their names; query and mutation procedures with finite results gain
 * composables and utilities beside the native methods.
 * Procedures whose output includes an async iterable retain only the native methods.
 */
export type TRPCVueQueryClient<TRouter extends AnyTRPCRouter> = TRPCClient<TRouter> &
  DecoratedRecord<TRouter, TRouter["_def"]["record"]>
