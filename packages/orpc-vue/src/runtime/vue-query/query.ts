import type { ClientContext } from "@orpc/client"
import type { ProcedureUtils } from "@orpc/tanstack-query"
import { type QueryClient, skipToken, useQuery } from "@tanstack/vue-query"
import { cloneDeep } from "es-toolkit"
import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  type MaybeRefOrGetter,
  onMounted,
  onScopeDispose,
  onServerPrefetch,
  ref,
  toRaw,
  toValue,
  watch,
} from "vue"

import type { AwaitableQuery, ORPCQueryOptions, ORPCQueryResult } from "../types"

type RuntimeOptions = ORPCQueryOptions<ClientContext, unknown, Error> & {
  clone?: boolean
  select?: (data: unknown) => unknown
}
type RuntimeProcedure = ProcedureUtils<ClientContext, unknown, unknown, Error>

/**
 * Observe one oRPC procedure with reactive input, SSR prefetching and optional local cloning.
 * Registers lifecycle hooks synchronously and returns query state that can also be awaited.
 * Nested edits affect only the opt-in clone; whole-value assignments write through to the cache.
 * Selected data cannot be assigned back because its shape may differ from the cached response.
 *
 * @param target - The procedure's upstream TanStack utilities, supplied by the client decorator.
 * @param input - A value, ref or getter; skipToken suppresses automatic fetching.
 * @param options - Query options, optionally wrapped in a ref or getter.
 * @param queryClient - The cache owner resolved by the client factory.
 * @returns Live query refs plus a promise waiting for the initial active fetch.
 */
export function useORPCQuery(
  target: object,
  input: unknown,
  options: unknown,
  queryClient: QueryClient,
): AwaitableQuery<ORPCQueryResult<unknown, Error, true>> {
  if (!getCurrentScope()) {
    throw new Error("useQuery() requires a component setup or an active Vue effect scope.")
  }
  const procedure = target as RuntimeProcedure
  const instance = getCurrentInstance()
  // A standalone browser scope has no mount hook; component queries wait for actual mounting.
  const mounted = ref(typeof window !== "undefined" && !instance)
  if (instance)
    onMounted(() => {
      mounted.value = true
    })

  const settings = computed(
    () => toValue(options as MaybeRefOrGetter<RuntimeOptions | undefined>) ?? {},
  )
  const queryOptions = computed(() => {
    const { clone, server, context, enabled, ...rest } = settings.value
    if (clone && rest.select) {
      throw new TypeError("clone: true cannot be combined with select.")
    }
    // Snapshot reactive input so an existing cache entry never changes its identity in place.
    const snapshot = cloneDeep(toValue(input))
    const isEnabled = toValue(enabled)
    return {
      ...procedure.queryOptions({
        ...rest,
        input: snapshot,
        context: toValue(context),
      } as Parameters<RuntimeProcedure["queryOptions"]>[0]),
      // Omit an unspecified enabled value so QueryClient defaults still apply.
      ...(snapshot === skipToken || (server === false && !mounted.value)
        ? { enabled: false }
        : isEnabled === undefined
          ? {}
          : { enabled: isEnabled }),
      shallow: false,
    }
  })
  const query = useQuery(queryOptions, queryClient)
  const queryHash = computed(() => queryClient.defaultQueryOptions(queryOptions.value).queryHash)
  const localData = ref<unknown>()
  /** Discard local edits and copy the current query's data without retaining its readonly proxy. */
  function resetClone() {
    if (settings.value.clone) localData.value = cloneDeep(toRaw(query.data.value))
  }
  watch([query.data, queryHash, () => settings.value.clone], resetClone, {
    immediate: true,
    // A queued reset could overwrite local edits made immediately after a cache assignment.
    flush: "sync",
  })
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    // Success is significant even when structural sharing preserves data and timestamps coincide.
    if (
      event.type === "updated" &&
      event.action.type === "success" &&
      event.query.queryHash === queryHash.value
    ) {
      resetClone()
    }
  })
  onScopeDispose(unsubscribe)

  const data = computed({
    get: () => (settings.value.clone ? localData.value : query.data.value),
    set(value: unknown) {
      if (settings.value.select) throw new TypeError("Query data is readonly when select is used.")
      // Use the current reactive key; callers own any external references to the assigned value.
      queryClient.setQueryData(queryOptions.value.queryKey, value)
      resetClone()
    },
  })
  const result = {
    ...query,
    data,
    invalidate: () =>
      queryClient.invalidateQueries({
        queryKey: queryOptions.value.queryKey,
        exact: true,
      }),
  }

  // Disabled, client-only and offline-paused queries must not block setup or SSR.
  const loaded = query.fetchStatus.value === "fetching" ? query.suspense() : Promise.resolve()
  if (instance) onServerPrefetch(() => loaded)
  // Resolve to plain state rather than the promise itself to avoid thenable resolution cycles.
  const awaitable = Object.assign(
    loaded.then(() => result),
    result,
  )
  // A query also works without await; errors remain observable through its state.
  void awaitable.catch(() => {})
  return awaitable
}
