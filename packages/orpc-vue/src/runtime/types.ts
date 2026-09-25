import type { AnyNestedClient, Client, ClientContext, FriendlyClientOptions } from "@orpc/client"
import type { RouterUtils } from "@orpc/tanstack-query"
import type {
  QueryClient,
  SkipToken,
  UseMutationOptions,
  UseMutationReturnType,
  UseQueryOptions,
  UseQueryReturnType,
} from "@tanstack/vue-query"
import type { ComputedRef, DeepReadonly, MaybeRefOrGetter, Ref, WritableComputedRef } from "vue"

import type { DefinedErrorCode, DefinedErrorHandlers, HandledResult } from "./client/error"

/** Configure cache ownership and key namespacing when wrapping an application-owned client. */
export interface ORPCVueQueryOptions {
  /** Separate the cache keys of clients whose procedure paths overlap. */
  prefix?: string
  /** Use an explicit client when creating composables in an effect scope without Vue injection. */
  queryClient?: QueryClient
}

/**
 * An oRPC client decorated with Vue composables and the official TanStack Query utilities.
 * Router branches retain their names; finite procedures gain query and mutation composables
 * and `callCatching()`.
 * Procedures whose output includes an async iterable retain only the upstream utilities.
 */
export type ORPCVueQueryClient<T extends AnyNestedClient> = RouterUtils<T> & {
  /** Invalidate all inputs of this procedure, or every query under this router branch. */
  invalidate: () => Promise<void>
} & (T extends Client<infer C, infer I, infer O, infer E>
    ? Extract<O, AsyncIterable<unknown>> extends never
      ? ProcedureHooks<C, I, O, E>
      : object
    : {
        [K in keyof T]: T[K] extends AnyNestedClient ? ORPCVueQueryClient<T[K]> : never
      })

/**
 * Query state is available synchronously; awaiting it waits for the initial active fetch.
 * Awaiting an inactive query returns its current state without waiting for it to become enabled.
 */
export type AwaitableQuery<T> = T & Promise<T>

/** Vue Query state with cache-writing data assignment and an optional mutable local clone. */
export type ORPCQueryResult<TOutput, TError, TClone extends boolean = false> = Omit<
  UseQueryReturnType<TOutput, TError>,
  "data"
> & {
  /**
   * Assign a whole response to update the shared cache for the current input.
   * Nested edits require clone: true and remain local until a whole value is assigned.
   * Successful cache updates replace that local clone and discard its edits.
   */
  data: WritableComputedRef<
    (TClone extends true ? TOutput : DeepReadonly<TOutput>) | undefined,
    TOutput
  >
  /** Invalidate this query's current input and refetch active observers. */
  invalidate: () => Promise<void>
}

/** Vue Query state projected through select while the cache retains the original response. */
export type ORPCSelectedQueryResult<TSelected, TError> = Omit<
  UseQueryReturnType<TSelected, TError>,
  "data"
> & {
  /** The selected value and its nested properties are readonly. */
  data: ComputedRef<DeepReadonly<TSelected> | undefined>
  /** Invalidate the underlying query for the current input and refetch active observers. */
  invalidate: () => Promise<void>
}

/** Extract the options object from Vue Query's ref/getter wrappers before replacing fields. */
type ResolveOptions<T> =
  T extends Ref<infer U> ? U : T extends () => infer U ? ResolveOptions<U> : T
/** Keep context mandatory when the wrapped client requires fields the caller must supply. */
type ContextOptions<C extends ClientContext> = object extends C
  ? { context?: MaybeRefOrGetter<C> }
  : { context: MaybeRefOrGetter<C> }

/**
 * Reactive Vue Query options with procedure-derived keys, query functions and oRPC client context.
 * The useQuery overloads add mutually exclusive select and clone options.
 */
export type ORPCQueryOptions<C extends ClientContext, O, E, S = O> = Omit<
  ResolveOptions<UseQueryOptions<O, E, S>>,
  "queryKey" | "queryFn" | "select" | "shallow" | "enabled"
> &
  ContextOptions<C> & {
    /** Control automatic fetching reactively; disabled queries can still expose cached data. */
    enabled?: MaybeRefOrGetter<boolean | undefined>
    /** Use false to start the query only after the component mounts in the browser. */
    server?: boolean
  }

/** Vue Query mutation options with procedure-derived keys, mutation functions and client context. */
export type ORPCMutationOptions<C extends ClientContext, I, O, E, M = unknown> = Omit<
  ResolveOptions<UseMutationOptions<O, E, I, M>>,
  "mutationKey" | "mutationFn" | "shallow"
> &
  ContextOptions<C>

type QueryInput<I> = MaybeRefOrGetter<I | SkipToken>
/** Allow omitted input only when its type permits it, while preserving required client context. */
type QueryArgs<C extends ClientContext, I, Options> = object extends C
  ? undefined extends I
    ? [input?: QueryInput<I>, options?: Options]
    : [input: QueryInput<I>, options?: Options]
  : [input: QueryInput<I>, options: Options]

/** Carry each procedure's input, output, error and context types through the runtime decorator. */
interface ProcedureHooks<C extends ClientContext, I, O, E> {
  /** Observe a query with a mutable local clone; whole-value assignments update the shared cache. */
  useQuery(
    input: QueryInput<I>,
    options: MaybeRefOrGetter<ORPCQueryOptions<C, O, E> & { clone: true; select?: never }>,
  ): AwaitableQuery<ORPCQueryResult<O, E, true>>
  /** Observe a readonly projection of cached data; select cannot be combined with clone: true. */
  useQuery<S>(
    input: QueryInput<I>,
    options: MaybeRefOrGetter<
      ORPCQueryOptions<C, O, E, S> & { select: (data: O) => S; clone?: never }
    >,
  ): AwaitableQuery<ORPCSelectedQueryResult<S, E>>
  /** Observe a reactive query with readonly nested data and cache-writing whole-value assignment. */
  useQuery(
    ...args: QueryArgs<
      C,
      I,
      MaybeRefOrGetter<ORPCQueryOptions<C, O, E> & { clone?: false; select?: never }>
    >
  ): AwaitableQuery<ORPCQueryResult<O, E>>
  /** Create a mutation observer; call mutate or mutateAsync to execute the procedure. */
  useMutation<M = unknown>(
    ...args: object extends C
      ? [options?: MaybeRefOrGetter<ORPCMutationOptions<C, I, O, E, M>>]
      : [options: MaybeRefOrGetter<ORPCMutationOptions<C, I, O, E, M>>]
  ): UseMutationReturnType<O, E, I, M>
  /**
   * Call the procedure and handle selected declared errors like `catchORPCError()`.
   * Pass `undefined` as input for procedures without input.
   */
  callCatching<Handlers extends object & DefinedErrorHandlers<E>>(
    input: I,
    handlers: Handlers & Record<Exclude<keyof Handlers, DefinedErrorCode<E>>, never>,
    ...rest: object extends C
      ? [options?: FriendlyClientOptions<C>]
      : [options: FriendlyClientOptions<C>]
  ): Promise<O | HandledResult<Handlers>>
}
