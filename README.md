# orpc-nuxt

oRPC v2 integration for Nuxt 3 and 4, built on TanStack Vue Query.
Add `useQuery` and `useMutation` to your oRPC procedures, with types inferred from your router.

```ts
const orpc = useOrpc()
const { data } = await orpc.blog.posts.get.useQuery({ id: 1 })
```

Inspired by [trpc-nuxt](https://github.com/wobsoriano/trpc-nuxt).

## Install

```sh
npm install orpc-nuxt @orpc/client@2.0.0-beta.35 @orpc/server@2.0.0-beta.35 @orpc/tanstack-query@2.0.0-beta.35 @tanstack/vue-query
```

Install oRPC by version: v2 is still in beta, and this package needs `2.0.0-beta.35` or newer.

## Setup

Register the module:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["orpc-nuxt"],
})
```

Add a plugin for browser and SSR requests:

```ts
// app/plugins/orpc.ts
import type { RouterClient } from "@orpc/server"
import { defineNuxtPlugin } from "orpc-nuxt/plugin"
import type { router } from "~~/server/rpc/router"

export default defineNuxtPlugin<RouterClient<typeof router>>(() => {
  return {
    url: "/rpc",
    forwardHeaders: ["cookie"], // Forward the visitor's cookies during SSR.
  }
})
```

This assumes you have a router exported from `server/rpc/router.ts` and an RPC handler at `/rpc`; see the [oRPC Nuxt adapter](https://orpc.dev/docs/adapters/nuxt) to set them up.

The helper sends both browser and SSR requests over HTTP.
For direct router calls during SSR with your own `context`, use [manual client setup](#manual-client-setup).

## Queries

Call `useQuery` in `<script setup>` or a Vue component's `setup()` function.
Use your router's procedure paths; the examples below use posts from a blog router.

```ts
const orpc = useOrpc()
const query = await orpc.blog.posts.get.useQuery({ id: 1 })
```

`query` exposes reactive state and methods, including:

- `query.data.value` contains the query result, or `undefined` before data is available.
- `query.isPending.value` is `true` before the first success or error, even when disabled.
- `query.error.value` contains the query error, or `null` when there is no error.
- `query.refetch()` fetches the current query again.
- `query.invalidate()` marks its cached result as stale and refetches it if it is active.

### Reactive input and options

Pass a ref, reactive object, or getter when the input can change.
The query follows the current input and uses its cached result when available.

The second argument accepts both TanStack Vue Query options (such as `select`, `enabled`, and `staleTime`) and orpc-nuxt options (such as `clone` and `server`).

```ts
const route = useRoute()
const panelOpen = ref(true)

const query = orpc.blog.posts.get.useQuery(() => ({ id: Number(route.params.id) }), {
  enabled: panelOpen,
  staleTime: 30_000,
})
```

Here, changing the route ID switches to that post's query, and closing the panel disables automatic fetching.

Vue Query options such as `enabled` and `staleTime` can be reactive too.
You can also pass the entire options object as a ref or getter.

### Waiting for input

Use TanStack Query's `skipToken` when you don't have valid input yet.
This query starts once a post is selected:

```ts
import { skipToken } from "@tanstack/vue-query"

const selectedId = ref<number>()
const query = orpc.blog.posts.get.useQuery(() =>
  selectedId.value === undefined ? skipToken : { id: selectedId.value },
)
```

### Awaiting queries and server rendering

You can use `useQuery` with or without `await`.
Without it, you get the query refs immediately and can show a loading state.
With it, you wait for the initial fetch.
During SSR, the page waits for active queries either way.

Set `server: false` in the query options to fetch only after the component mounts in the browser.
The query refs are still available during SSR.

`await` returns the current state immediately when no fetch is running.
This includes disabled queries, `skipToken`, queries waiting for the component to mount, and requests paused because the browser is offline.
It does not wait for these queries to become enabled or resume fetching.

Failed queries expose the error in `query.error.value`.
Set `throwOnError: true` if you also want `await` to throw and Vue to handle the error through its error hooks or boundaries.

## Mutations

Use `useMutation` for actions such as creating or updating a post.

```ts
const orpc = useOrpc()
const mutation = orpc.blog.posts.create.useMutation({
  onSuccess: () => orpc.blog.posts.invalidate(),
})

await mutation.mutateAsync({ title: "New post" })
```

`mutation` exposes reactive state and methods, including:

- `mutation.mutate(input)` starts the request and returns `void`; read the result from `mutation.data.value` or handle it in `onSuccess`.
- `mutation.mutateAsync(input)` starts the request and returns a `Promise` that resolves with the response or rejects with the error, so you can use `await` and `try/catch`.
- `mutation.data.value` contains the mutation result, or `undefined` before data is available.
- `mutation.isPending.value` is `true` while the mutation is running.
- `mutation.error.value` contains the mutation error, or `null` when there is no error.

The `onSuccess` callback above refreshes active post queries after creating a post.

### Invalidation

Choose how much of the cache to invalidate:

```ts
// Every cached input of this procedure.
await orpc.blog.posts.get.invalidate()

// Every query under this router branch.
await orpc.blog.posts.invalidate()

// Only this query's current input.
await query.invalidate()
```

Invalidation marks matching queries as stale and refetches active ones.
Inactive queries can refresh when used again.
Create the decorated client inside your app plugin so callbacks use that app's QueryClient.

## Direct calls and oRPC utilities

Use `.call()` when you just need a procedure's response, without query state or caching:

```ts
const post = await orpc.blog.posts.get.call({ id: 1 })
```

The client also exposes oRPC's utilities:

- `.key()` builds a cache key prefix for a procedure or router branch.
- `.queryKey()` builds a query key for a specific input.
- `.queryOptions()` builds options for Vue Query's `useQuery`.
- `.mutationOptions()` builds options for Vue Query's `useMutation`.
- `.infiniteOptions()` builds options for Vue Query's `useInfiniteQuery` for pagination.

Subscription composables are not available yet.
Procedures that return streams keep the oRPC utilities but do not get this package's `useQuery` or `useMutation` methods.
The module does not automatically transfer streamed query results from server to browser.

## Query data

### Updating cached data

Assigning a new response to `data.value` updates the shared cache for the query's current input.
Other components reading the same query see the update too.
Nested properties are readonly unless you enable `clone: true`.

```ts
const { data } = await orpc.blog.posts.get.useQuery({ id: 1 })

const response = await orpc.blog.posts.update.call({
  id: 1,
  title: "Updated title",
})

data.value = response
```

Treat the original `response` as readonly after assigning it to `data.value`.
The assignment passes it to the cache without a defensive copy, so changing `response.title` could modify cached data directly.

### Mutable data

With `clone: true`, `data.value` contains a reactive local copy that you can edit, for example in a form.
There are two ways to change it:

- Edit a nested property to change only your local copy.
- Assign a whole response to `data.value` to update the shared cache and reset the local copy.

```ts
const id = 1
const { data } = await orpc.blog.posts.get.useQuery({ id }, { clone: true })

if (data.value) {
  // Only this query's local copy changes.
  data.value.title = "Local draft"

  // Save the draft, then share the server's response with other components.
  data.value = await orpc.blog.posts.update.call({
    id,
    title: data.value.title,
  })
}
```

After assigning a response, you can keep editing `data.value.title`; those edits still affect only the new local copy.

A successful refetch or cache update replaces the local copy and discards its edits, even if the returned data has not changed.
Changing the query input also switches the copy to that input's data.
Keep a separate form draft if it must survive these updates.

You cannot combine `clone: true` with `select`; selected results are readonly.

## Advanced

### Separate API service

If your API runs in a separate service, configure the base URLs in `nuxt.config.ts`, without the `/rpc` path:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["orpc-nuxt"],
  runtimeConfig: {
    orpc: {
      apiOrigin: "", // Optional SSR address; empty means use public.orpc.apiOrigin.
    },
    public: {
      orpc: {
        apiOrigin: "https://api.example.com",
      },
    },
  },
})
```

Set `NUXT_PUBLIC_ORPC_API_ORIGIN` to the browser-facing API origin.
Use `NUXT_ORPC_API_ORIGIN` if SSR should use an internal address such as `http://api:3000`.

Use these settings in `app/plugins/orpc.ts`:

```ts
// app/plugins/orpc.ts
import type { router } from "@my-app/api"
import type { RouterClient } from "@orpc/server"
import { defineNuxtPlugin } from "orpc-nuxt/plugin"

export default defineNuxtPlugin<RouterClient<typeof router>>(() => {
  const config = useRuntimeConfig()
  const serverOrigin = import.meta.server ? config.orpc.apiOrigin : ""

  return {
    url: `${config.public.orpc.apiOrigin}/rpc`,
    serverUrl: serverOrigin ? `${serverOrigin}/rpc` : undefined,
    credentials: "include",
    forwardHeaders: ["cookie"],
  }
})
```

`serverUrl` overrides `url` during SSR; an empty or omitted value falls back to `url`.
Relative URLs resolve against the current request URL during SSR.
Only headers listed in `forwardHeaders` are forwarded from the incoming SSR request.
`credentials: "include"` allows browser cookies on cross-origin requests.

### Manual client setup

Use `createORPCNuxtClient` when you need a custom transport or want SSR to call the router directly.
Instead of the shared HTTP plugin above, add a browser plugin and a server plugin.

Keep `orpc-nuxt` in `modules`: manual setup replaces that plugin, not the module that installs the QueryClient and the composables.
Both plugins provide the client under the `orpc` key: `useOrpc()` reads it as `useNuxtApp().$orpc` and infers the router type from that injection.

The browser plugin sends requests to `/rpc` over HTTP:

```ts
// app/plugins/orpc.client.ts
import { createORPCClient } from "@orpc/client"
import { RPCLink } from "@orpc/client/fetch"
import type { RouterClient } from "@orpc/server"
import { createORPCNuxtClient } from "orpc-nuxt/client"
import type { router } from "~~/server/rpc/router"

export default defineNuxtPlugin(() => {
  const client = createORPCClient<RouterClient<typeof router>>(new RPCLink({ url: "/rpc" }))
  const orpc = createORPCNuxtClient(client)
  return {
    provide: { orpc },
  }
})
```

The server plugin calls the router directly, without an HTTP request.
This example passes the current Nuxt request event as `context.event`; adjust it to match your router:

```ts
// app/plugins/orpc.server.ts
import { createRouterClient } from "@orpc/server"
import { createORPCNuxtClient } from "orpc-nuxt/client"
import { router } from "~~/server/rpc/router"

export default defineNuxtPlugin(() => {
  const event = useRequestEvent()!
  const client = createRouterClient(router, {
    context: { event },
  })
  const orpc = createORPCNuxtClient(client)
  return {
    provide: { orpc },
  }
})
```

Let both plugins infer the client type instead of annotating it.
Nuxt combines what they provide, so a widened type in either one leaves `useOrpc()` without procedure types.

### SSR and cache configuration

The module gives each server request its own QueryClient, which manages the query cache.
It sends cached results to the browser in the Nuxt payload, so the browser can reuse data fetched during SSR.
Queries stay fresh for 5 seconds by default to avoid immediately fetching that data again.

Set static QueryClient defaults in `nuxt.config.ts`.
This example keeps results fresh for 30 seconds and disables retries:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["orpc-nuxt"],
  orpc: {
    queryClient: {
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          retry: false,
        },
      },
    },
  },
})
```

Query inputs can include oRPC types such as `bigint` and `Date`; the module supports them in cache keys.
For custom classes in query results, register a Nuxt payload serializer or use TanStack dehydration options to exclude those queries from the payload.

### Runtime configuration

For callbacks, custom cache instances, or settings that depend on the current request, add an `orpc:query-client` hook in a Nuxt plugin.
The module calls it with the configuration after applying static defaults and before creating the QueryClient.
This example logs failed queries:

```ts
// app/plugins/query-config.ts
import { QueryCache } from "@tanstack/vue-query"

export default defineNuxtPlugin({
  hooks: {
    "orpc:query-client"(config) {
      config.queryCache = new QueryCache({
        onError(error) {
          console.error("Query failed:", error)
        },
      })
    },
  },
})
```

Nuxt registers the handlers declared in `hooks` before running plugins, so this handler is ready when the module creates the QueryClient.

### Query client

`useOrpcQueryClient()` returns the QueryClient installed for the app, whether by the module or by your own plugin.
Unlike Vue Query's `useQueryClient()`, it also works where Vue injection is unavailable, such as in an event handler or between tests:

```ts
const queryClient = useOrpcQueryClient()
queryClient.clear()
```

It needs the Nuxt context, which the browser keeps available once the app has started.
During server rendering, call it inside `nuxtApp.runWithContext()`.

### Existing Vue Query setup

If your app already installs Vue Query and transfers its cache between server and browser, disable the module's QueryClient setup:

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ["orpc-nuxt"],
  orpc: { queryClient: false },
})
```

Your Vue Query plugin must install QueryClient before the oRPC plugin runs.
Use `enforce: "pre"` and omit `parallel: true`.

### Multiple clients

If you have multiple oRPC clients with the same procedure paths, give each a different `prefix` so they don't share cached results:

```ts
const orpc = createORPCNuxtClient(client, { prefix: "blog" })
```

### Component tests

Configure the Nuxt test environment and load a shared setup file:

```ts
// vitest.config.ts
import { defineVitestConfig } from "@nuxt/test-utils/config"

export default defineVitestConfig({
  test: {
    setupFiles: ["test/nuxt/setup.ts"],
  },
})
```

That configuration runs every test under `test/nuxt/` or `tests/nuxt/`, and every test named `*.nuxt.test.ts` or `*.nuxt.spec.ts`, against your application.
Use `createTestORPCClient()` from `orpc-nuxt/testing` to replace `useOrpc()` with an isolated fake client.
`client` includes the regular composables and oRPC utilities.
Each procedure leaf in `procedures` has a `.handle()` method that registers a typed handler and returns a Vitest mock.

```ts
// test/nuxt/setup.ts
import { mockNuxtImport } from "@nuxt/test-utils/runtime"
import type { RouterClient } from "@orpc/server"
import { QueryClient } from "@tanstack/vue-query"
import { createTestORPCClient } from "orpc-nuxt/testing"
import { afterEach } from "vitest"

import type { router } from "~~/server/rpc/router"

const queryClient = new QueryClient({
  // Report a failing procedure instead of retrying it until the test times out.
  defaultOptions: { queries: { retry: false } },
})

export const { client, procedures, reset } = createTestORPCClient<RouterClient<typeof router>>({
  queryClient,
})

// Return the composable itself; Vitest hoists this factory before the setup file runs.
mockNuxtImport("useOrpc", () => () => client)

afterEach(() => {
  reset() // Remove registered handlers.
  queryClient.clear() // Remove cached responses.
})
```

`orpc-nuxt/testing` does not import `nuxt/app`, so the hoisted `mockNuxtImport()` factory can load it safely.
The explicit QueryClient keeps the test cache isolated and lets the setup clear it after each test.
To use the application's QueryClient instead, omit the option and configure its defaults through `orpc.queryClient`.
In that mode, import `useOrpcQueryClient()` only from a module that the hoisted factory cannot reach.

Register the required handlers before mounting; `mountSuspended()` waits for awaited queries before assertions:

```ts
// test/nuxt/post-list.spec.ts
import { mountSuspended } from "@nuxt/test-utils/runtime"
import { expect, test } from "vitest"

import PostList from "~/components/post-list.vue"

import { procedures } from "./setup"

test("renders the posts", async () => {
  const list = procedures.blog.posts.list.handle(() => [{ id: 1, title: "First post" }])
  const component = await mountSuspended(PostList)

  expect(component.text()).toContain("First post")
  expect(list).toHaveBeenCalledOnce()
})
```

### Outside Vue components

You can call `.useQuery()` and `.useMutation()` outside a component, for example in a script or in a test that never mounts one.
Create them inside `scope.run()` so Vue can track their reactive subscriptions, then call `scope.stop()` when you are done.
When Vue injection is unavailable, pass a QueryClient explicitly:

```ts
import { QueryClient } from "@tanstack/vue-query"
import { createORPCNuxtClient } from "orpc-nuxt/client"
import { effectScope } from "vue"

const queryClient = new QueryClient()
const orpc = createORPCNuxtClient(client, { queryClient })
const scope = effectScope()

try {
  const { data } = await scope.run(() => {
    return orpc.blog.posts.get.useQuery({ id: 1 })
  })!

  console.log(data.value)
} finally {
  scope.stop()
  queryClient.clear()
}
```

## Development

Install dependencies with `bun install`, then run `bun run build`, `bun run types`, and `bun run test`.

Run `bun run test:component` to check the documented component-test recipe in the fixture application; it uses the built package, so build first.

To try the package in a Nuxt app, build it and run `bunx nuxt dev tests/fixtures/nuxt`.
The example app uses the built package, so rebuild after changing its source.

Run `bunx playwright install chromium-headless-shell`, then `bun run test:nuxt` to check the packed npm archive with the Nuxt version installed in the workspace.
It is checked with both module-managed and app-managed QueryClients, including types, SSR, and hydration in development and production.

To check other Nuxt versions by hand, pass them explicitly: `bun run test:nuxt 3.14.1592 4.0.1`.
