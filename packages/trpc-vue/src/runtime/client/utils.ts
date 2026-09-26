import {
  type DataTag,
  type InfiniteData,
  type InfiniteQueryObserverOptions,
  type MutationObserverOptions,
  type QueryFunctionContext,
  type QueryKey,
  type QueryObserverOptions,
  type SkipToken,
  skipToken,
} from "@tanstack/vue-query"
import type { TRPCRequestOptions as NativeRequestOptions, TRPCUntypedClient } from "@trpc/client"
import type { AnyTRPCRouter, DeepPartial } from "@trpc/server"

import { createMutationKey, createQueryKey, type TRPCQueryKey } from "./keys"

/** Request context and opt-in TanStack cancellation for query observers and builders. */
export interface TRPCRequestOptions extends Omit<NativeRequestOptions, "signal"> {
  /** Forward TanStack's AbortSignal; otherwise requests may finish after observers unmount. */
  abortOnUnmount?: boolean
}

/** tRPC request options of a query observer or builder. */
export interface QueryRequestOptions {
  /** Request context and cancellation passed to the tRPC links. */
  trpc?: TRPCRequestOptions
}

/** tRPC request options of a mutation observer or builder. */
export interface MutationRequestOptions {
  /** Request context passed to the tRPC links; mutations do not receive query cancellation. */
  trpc?: Omit<NativeRequestOptions, "signal">
}

type InputArgs<TInput, Options> = undefined extends TInput
  ? [input?: TInput | SkipToken, options?: Options]
  : [input: TInput | SkipToken, options?: Options]
type BuilderOptions<TOutput, TError, TSelected> = Omit<
  QueryObserverOptions<TOutput, TError, TSelected>,
  "queryKey" | "queryFn" | "queryKeyHashFn" | "queryHash" | "enabled"
> & { enabled?: boolean; trpc?: TRPCRequestOptions }
type BuiltQueryOptions<TOutput, TError, TSelected> = Omit<
  QueryObserverOptions<TOutput, TError, TSelected, TOutput, TRPCQueryKey<TOutput, TError>>,
  "enabled"
> & { enabled?: boolean; queryKey: TRPCQueryKey<TOutput, TError>; trpc: { path: string } }
type Cursor<TInput> =
  | (TInput extends { cursor?: infer TCursor } ? NonNullable<TCursor> : never)
  | null
  | undefined
type InfiniteInput<TInput> = TInput extends object ? Omit<TInput, "cursor" | "direction"> : TInput
type InfiniteOptions<TInput, TOutput, TError, TSelected> = Omit<
  InfiniteQueryObserverOptions<TOutput, TError, TSelected, QueryKey, Cursor<TInput>>,
  "queryKey" | "queryFn" | "queryKeyHashFn" | "queryHash" | "initialPageParam"
> & { initialCursor?: Cursor<TInput>; trpc?: TRPCRequestOptions }
type BuiltInfiniteOptions<TInput, TOutput, TError, TSelected> = InfiniteQueryObserverOptions<
  TOutput,
  TError,
  TSelected,
  TRPCQueryKey<InfiniteData<TOutput, Cursor<TInput>>, TError>,
  Cursor<TInput>
> & {
  queryKey: TRPCQueryKey<InfiniteData<TOutput, Cursor<TInput>>, TError>
  trpc: { path: string }
}

/** Typed key and option builders of a query procedure. */
export interface QueryUtils<TInput, TOutput, TError> {
  /** Build a query key, optionally narrowing it with partial input. */
  queryKey(input?: DeepPartial<TInput> | SkipToken): TRPCQueryKey<TOutput, TError>
  /** Build a snapshot of options; call inside computed() when the source input is reactive. */
  queryOptions<TSelected = TOutput>(
    ...args: InputArgs<TInput, BuilderOptions<TOutput, TError, TSelected>>
  ): BuiltQueryOptions<TOutput, TError, TSelected>
}
/** Typed infinite-query builders of a query procedure whose input has a cursor. */
export interface InfiniteUtils<TInput, TOutput, TError> {
  /** Build an infinite key without cursor or direction, optionally narrowing partial input. */
  infiniteQueryKey(
    input?: DeepPartial<InfiniteInput<TInput>> | SkipToken,
  ): TRPCQueryKey<InfiniteData<TOutput, Cursor<TInput>>, TError>
  /** Build options for Vue Query's useInfiniteQuery; pageParam becomes cursor for each request. */
  infiniteQueryOptions<TSelected = InfiniteData<TOutput, Cursor<TInput>>>(
    input: InfiniteInput<TInput> | SkipToken,
    options: InfiniteOptions<TInput, TOutput, TError, TSelected>,
  ): BuiltInfiniteOptions<TInput, TOutput, TError, TSelected>
}
/** Typed key and option builders of a mutation procedure. */
export interface MutationUtils<TInput, TOutput, TError> {
  /** Build a mutation key for this procedure. */
  mutationKey(): DataTag<QueryKey, TOutput, TError>
  /** Build mutation options without installing an observer. */
  mutationOptions<TOnMutateResult = unknown>(
    options?: Omit<
      MutationObserverOptions<TOutput, TError, TInput, TOnMutateResult>,
      "mutationKey" | "mutationFn"
    > &
      MutationRequestOptions,
  ): MutationObserverOptions<TOutput, TError, TInput, TOnMutateResult> & {
    mutationKey: DataTag<QueryKey, TOutput, TError>
    trpc: { path: string }
  }
}

type RuntimeOptions = Record<string, unknown> & {
  trpc?: TRPCRequestOptions
  initialCursor?: unknown
}

/** Build keys and TanStack options for one tRPC path, with resolved inputs and native errors. */
export function createProcedureUtils<TRouter extends AnyTRPCRouter>(
  client: TRPCUntypedClient<TRouter>,
  path: string[],
  prefix?: string,
) {
  const name = path.join(".")
  const key = (input: unknown, type: "any" | "query" | "infinite") =>
    createQueryKey(path, input, type, prefix)

  function queryOptions(
    input: unknown,
    settings: RuntimeOptions = {},
    infinite = false,
  ): QueryObserverOptions<unknown, Error> & {
    trpc: { path: string }
    initialPageParam?: unknown
  } {
    // Builders accept values; composables unwrap refs/getters before reaching this boundary.
    const queryKey = key(input, infinite ? "infinite" : "query")
    const args = queryKey.at(-1) as { input?: unknown }
    const { trpc, initialCursor, ...rest } = settings
    return {
      ...rest,
      queryKey,
      queryFn:
        input === skipToken
          ? skipToken
          : async (context: QueryFunctionContext) => {
              const actualInput = infinite
                ? {
                    ...(args.input as object),
                    ...(context.pageParam !== undefined ? { cursor: context.pageParam } : {}),
                    direction: context.direction,
                  }
                : args.input
              const result: unknown = await client.query(name, actualInput, {
                ...trpc,
                // Match upstream: do not consume TanStack's signal unless cancellation is opted into.
                signal: trpc?.abortOnUnmount ? context.signal : undefined,
              })
              if (result && typeof result === "object" && Symbol.asyncIterator in result) {
                throw new TypeError(
                  "trpc-vue query utilities require finite results. Use the native .query() method for streaming queries.",
                )
              }
              return result
            },
      ...(infinite
        ? {
            initialPageParam: initialCursor ?? (input as { cursor?: unknown } | undefined)?.cursor,
          }
        : {}),
      trpc: { path: name },
    }
  }

  function mutationOptions(settings: RuntimeOptions = {}) {
    const { trpc, ...rest } = settings
    return {
      ...rest,
      mutationKey: createMutationKey(path, prefix),
      mutationFn: (input: unknown) => client.mutation(name, input, trpc),
      trpc: { path: name },
    }
  }

  return {
    pathKey: () => key(undefined, "any"),
    queryKey: (input: unknown) => key(input, "query"),
    infiniteQueryKey: (input: unknown) => key(input, "infinite"),
    queryOptions,
    infiniteQueryOptions: (input: unknown, settings?: RuntimeOptions) =>
      queryOptions(input, settings, true),
    mutationKey: () => createMutationKey(path, prefix),
    mutationOptions,
  }
}
