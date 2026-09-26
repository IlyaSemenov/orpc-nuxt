import {
  type MutationObserverOptions,
  type QueryClient,
  useMutation,
  type UseMutationOptions,
  type UseMutationReturnType,
} from "@tanstack/vue-query"
import { computed, getCurrentScope, type MaybeRefOrGetter, toValue } from "vue"

import type { ResolveOptions } from "./types"

/** Reactive Vue Query mutation options; the procedure derives keys and mutation functions. */
export type ReactiveMutationOptions<TInput, TOutput, TError, TOnMutateResult = unknown> = Omit<
  ResolveOptions<UseMutationOptions<TOutput, TError, TInput, TOnMutateResult>>,
  "mutationKey" | "mutationFn" | "shallow"
>

/**
 * The useMutation method of a mutation procedure.
 *
 * @typeParam TOptions - Protocol options accepted beside the Vue Query options.
 * @typeParam TOptionsRequired - Whether callers must pass options, for example required context.
 */
export interface MutationComposable<
  TInput,
  TOutput,
  TError,
  TOptions extends object = object,
  TOptionsRequired extends boolean = false,
> {
  /** Create a mutation observer; call mutate or mutateAsync to execute the procedure. */
  useMutation<TOnMutateResult = unknown>(
    ...args: TOptionsRequired extends true
      ? [
          options: MaybeRefOrGetter<
            ReactiveMutationOptions<TInput, TOutput, TError, TOnMutateResult> & TOptions
          >,
        ]
      : [
          options?: MaybeRefOrGetter<
            ReactiveMutationOptions<TInput, TOutput, TError, TOnMutateResult> & TOptions
          >,
        ]
  ): UseMutationReturnType<TOutput, TError, TInput, TOnMutateResult>
}

/** Resolve reactive options within the observer's scope; Vue Query owns execution and disposal. */
export function useReactiveMutation(
  buildOptions: (
    settings: Record<string, unknown>,
  ) => MutationObserverOptions<unknown, Error, unknown>,
  options: unknown,
  queryClient: QueryClient,
) {
  if (!getCurrentScope())
    throw new Error("useMutation() requires a component setup or an active Vue effect scope.")
  return useMutation(
    computed(() =>
      buildOptions(toValue(options as MaybeRefOrGetter<Record<string, unknown>>) ?? {}),
    ),
    queryClient,
  )
}
