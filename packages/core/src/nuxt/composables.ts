import type { QueryClient } from "@tanstack/vue-query"
import { useNuxtApp } from "nuxt/app"

import { resolveQueryClient } from "../vue-query/query-client"

/**
 * Read the QueryClient installed for the current Nuxt app, ignoring component-level providers.
 *
 * @param composable - The public composable's name, used in the error thrown without a cache.
 */
export function useNuxtQueryClient(composable: string): QueryClient {
  const queryClient = resolveQueryClient(useNuxtApp().vueApp)
  if (!queryClient) {
    throw new Error(
      `Install Vue Query before calling ${composable}(). Enable the module's queryClient option, or install Vue Query from a Nuxt plugin.`,
    )
  }
  return queryClient
}
