import { mockNuxtImport, mountSuspended } from "@nuxt/test-utils/runtime"
import { QueryClient } from "@tanstack/vue-query"
import { createORPCNuxtClient } from "orpc-nuxt/client"
import { afterEach, expect, test } from "vitest"

import PostList from "~/components/post-list.vue"

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
})

const orpc = createORPCNuxtClient(
  {
    blog: {
      posts: {
        // Resolve on a timer, so rendered posts prove that mounting awaited the query.
        list: async () => {
          await new Promise((resolve) => setTimeout(resolve, 10))
          return [{ id: 1, title: "First post" }]
        },
      },
    },
  },
  { queryClient },
)

// Vitest runs this factory before the file body, so it must return the composable without calling it.
mockNuxtImport("useOrpc", () => () => orpc)

afterEach(() => {
  queryClient.clear()
})

test("renders posts from a replaced client", async () => {
  const component = await mountSuspended(PostList)
  expect(component.text()).toContain("First post")
})

/** Never called: a plain object of async functions must still infer procedure composables. */
export function checkFakeClientTypes() {
  const query = orpc.blog.posts.list.useQuery()
  query.data.value?.[0]?.title satisfies string | undefined
  // @ts-expect-error Router branches expose no query composable.
  orpc.blog.posts.useQuery()
}
