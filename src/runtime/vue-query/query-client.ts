import { type QueryClient, VUE_QUERY_CLIENT } from "@tanstack/vue-query"
import { type App, hasInjectionContext, inject } from "vue"

/**
 * Find the QueryClient installed by Vue Query, with or without an active injection context.
 * An application is read directly, so a component providing its own cache cannot shadow the one
 * a plugin captured for the whole application.
 * Without an application, the active injection context is the only source.
 *
 * @param app - The application to read, whatever context the call happens in.
 * @returns The installed QueryClient, or undefined when Vue Query is unavailable.
 */
export function resolveQueryClient(app?: App): QueryClient | undefined {
  if (app) return app.runWithContext(injectQueryClient)
  return hasInjectionContext() ? injectQueryClient() : undefined
}

function injectQueryClient() {
  return inject<QueryClient | undefined>(VUE_QUERY_CLIENT, undefined)
}
