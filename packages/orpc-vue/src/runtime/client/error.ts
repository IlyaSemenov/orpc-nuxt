import { type AnyORPCError, isDefinedError } from "@orpc/client"

type ErrorOf<TPromise extends Promise<unknown>> = TPromise extends {
  __error?: { type: infer Error }
}
  ? Error
  : never

type DefinedError<TError> = Extract<TError, AnyORPCError>
/** Error codes declared by a procedure whose client error union is `TError`. */
export type DefinedErrorCode<TError> = DefinedError<TError>["code"] & string

type ErrorResultValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined
  | readonly unknown[]
  | { readonly [key: string]: unknown }

/** Handlers or result values keyed by the codes declared in the client error union `TError`. */
export type DefinedErrorHandlers<TError> = Partial<{
  [Code in DefinedErrorCode<TError>]:
    | ((error: Extract<DefinedError<TError>, { code: Code }>) => unknown)
    | ErrorResultValue
}>

/** The awaited result of any handler or value in `Handlers`. */
export type HandledResult<Handlers> = {
  [Code in keyof Handlers]: Handlers[Code] extends (...args: never[]) => infer Result
    ? Awaited<Result>
    : Awaited<Handlers[Code]>
}[keyof Handlers]

/**
 * Handle selected errors declared by an oRPC procedure and rethrow every other rejection.
 * The promise must come directly from a typed client call so its declared error union is preserved.
 * Each handler receives the declared error branch narrowed to its own code.
 * A non-function value is returned directly when its error code matches.
 * Synchronous and asynchronous handler results are included in the returned promise type.
 *
 * @param promise - The `PromiseWithError` returned by an oRPC client procedure.
 * @param handlers - Handlers keyed by declared error code.
 * @returns The procedure output or the result of the matching handler.
 */
export function catchORPCError<
  TPromise extends Promise<unknown>,
  Handlers extends object & DefinedErrorHandlers<ErrorOf<NoInfer<TPromise>>>,
>(
  promise: TPromise,
  handlers: "__error" extends keyof TPromise
    ? Handlers &
        Record<Exclude<keyof Handlers, DefinedErrorCode<ErrorOf<NoInfer<TPromise>>>>, never>
    : never,
): Promise<Awaited<TPromise> | HandledResult<Handlers>>

export function catchORPCError(
  promise: Promise<unknown>,
  handlers: Record<string, unknown>,
): Promise<unknown> {
  return catchDefinedErrors(promise, handlers)
}

/**
 * Untyped runtime of `catchORPCError()` for callers that enforce handler types themselves.
 *
 * @param promise - A procedure call result.
 * @param handlers - Handlers or result values keyed by declared error code.
 * @returns The procedure output or the result of the matching handler.
 */
export function catchDefinedErrors(
  promise: Promise<unknown>,
  handlers: Record<string, unknown>,
): Promise<unknown> {
  return promise.catch((error: unknown) => {
    // The upstream generic predicate narrows unknown to never, so provide the runtime union it checks.
    const orpcError = error as AnyORPCError | Error
    if (!isDefinedError(orpcError)) throw error

    if (!Object.hasOwn(handlers, orpcError.code)) throw error

    const handler = handlers[orpcError.code]
    return typeof handler === "function" ? handler(orpcError) : handler
  })
}
