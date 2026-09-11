import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import type { RouterClient } from "@orpc/server"
import { QueryClient } from "@tanstack/vue-query"
import { createTestORPCClient } from "orpc-nuxt/testing"
import { afterEach } from "vitest"
import type { router } from "~~/server/utils/router"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

export const { client, procedures, reset } = createTestORPCClient<RouterClient<typeof router>>({
  queryClient,
})

// This factory is hoisted before module initialization, so every dependency it reaches must be
// safe to load without entering the Nuxt runtime module graph.
mockNuxtImport("useOrpc", () => () => client)

afterEach(() => {
  reset()
  queryClient.clear()
})
