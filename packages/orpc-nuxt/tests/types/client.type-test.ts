import type { Client } from "@orpc/client"
import { createRouterClient, os } from "@orpc/server"
import { QueryClient, skipToken } from "@tanstack/vue-query"
import { createORPCNuxtClient } from "orpc-nuxt/client"
import { reactive, ref } from "vue"
import * as z from "zod"

const procedures = {
  get: os
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .handler(({ input }) => {
      return {
        id: input.id,
        author: { name: "Ada" },
      }
    }),
  ping: os.handler(() => "pong"),
  stream: os.handler(async function* () {
    yield "event"
  }),
}

// Reuse the same leaves at different depths so recursion cannot silently stop after one level.
const router = {
  ...procedures,
  blog: {
    posts: procedures,
    admin: {
      comments: procedures,
    },
    users: {
      get: os.handler(() => {
        return { name: "Ada" }
      }),
    },
    useQuery: { nested: procedures.ping },
    useMutation: procedures.ping,
    queryOptions: { nested: procedures.ping },
    invalidate: { nested: procedures.ping },
  },
}

/** Compile-only assertions against source types; invalid calls below must never execute. */
async function inference() {
  const client = createRouterClient(router)
  const orpc = createORPCNuxtClient(client, {
    queryClient: new QueryClient(),
  })
  const query = orpc.get.useQuery(() => ({ id: 1 }), {
    enabled: ref(true),
    staleTime: ref(1_000),
  })
  query.data.value = {
    id: 2,
    author: { name: "new" },
  }
  const id: number | undefined = query.data.value?.id
  // @ts-expect-error Cached nested values are readonly without a clone.
  query.data.value!.author.name = "wrong"
  const clone = await orpc.get.useQuery({ id: 1 }, { clone: true })
  clone.data.value!.author.name = "local"
  const selected = await orpc.get.useQuery({ id: 1 }, { select: (value) => value.author })
  const name: string | undefined = selected.data.value?.name
  // @ts-expect-error Selected data cannot be assigned back into the raw cache.
  selected.data.value = { name: "wrong" }
  // @ts-expect-error Selected objects are deeply readonly.
  selected.data.value!.name = "wrong"
  // @ts-expect-error A clone cannot be combined with select.
  orpc.get.useQuery({ id: 1 }, { clone: true, select: (value) => value.id })
  // @ts-expect-error Required input cannot be omitted.
  orpc.get.useQuery()
  // @ts-expect-error Invalid input.
  orpc.get.useQuery({ id: "1" })
  // @ts-expect-error Invalid output cannot enter the cache.
  query.data.value = { id: "1" }
  const ping = await orpc.ping.useQuery()
  const pong: string | undefined = ping.data.value
  const mutation = orpc.get.useMutation({
    onSuccess: (output) => {
      output.id satisfies number
    },
  })
  const output = await mutation.mutateAsync({ id: 1 })
  output.author.name satisfies string
  // @ts-expect-error Mutation input is inferred.
  mutation.mutate({ id: "wrong" })
  // @ts-expect-error Subscriptions are outside phase one.
  orpc.stream.useSubscription()
  // @ts-expect-error Endless streams are not regular SSR queries.
  orpc.stream.useQuery()
  return {
    id,
    name,
    pong,
  }
}

/** Cover reactive inputs, overloads and utilities through several router levels. */
async function nestedInference() {
  const client = createRouterClient(router)
  const orpc = createORPCNuxtClient(client)
  const input = ref({ id: 1 })
  const options = ref({ enabled: true })
  const query = orpc.blog.posts.get.useQuery(input, options)
  query.data.value?.id satisfies number | undefined
  // @ts-expect-error Nested output must not degrade to any.
  query.data.value?.id satisfies string
  // @ts-expect-error Cached nested data remains readonly.
  query.data.value!.author.name = "wrong"
  // @ts-expect-error Nested input is still required.
  orpc.blog.posts.get.useQuery()
  // @ts-expect-error Invalid reactive input must be rejected at a nested leaf.
  orpc.blog.posts.get.useQuery(ref({ id: "wrong" }))

  orpc.blog.posts.get.useQuery(reactive({ id: 1 }))
  orpc.blog.posts.get.useQuery(
    () => input.value,
    () => options.value,
  )
  orpc.blog.posts.get.useQuery(() => (options.value.enabled ? input.value : skipToken))
  const clone = await orpc.blog.posts.get.useQuery(input, { clone: true })
  clone.data.value!.author.name = "draft"
  // @ts-expect-error A mutable clone still preserves its response type.
  clone.data.value!.author.name = 123
  const selected = await orpc.blog.posts.get.useQuery(input, {
    select: (post) => {
      post.id satisfies number
      // @ts-expect-error The select callback receives the actual procedure output.
      void post.missing
      return post.author
    },
  })
  selected.data.value?.name satisfies string | undefined
  // @ts-expect-error Selected nested data remains readonly.
  selected.data.value!.name = "wrong"
  // @ts-expect-error Selection cannot be assigned into the underlying response cache.
  selected.data.value = { name: "wrong" }
  // @ts-expect-error clone and select remain mutually exclusive at nested leaves.
  orpc.blog.posts.get.useQuery(input, { clone: true, select: (post) => post.id })

  const mutation = orpc.blog.posts.get.useMutation({
    onSuccess: (output, variables) => {
      output.author.name satisfies string
      variables.id satisfies number
      // @ts-expect-error Mutation callback output must not become any.
      void output.name
    },
  })
  const updated = await mutation.mutateAsync({ id: 1 })
  updated.id satisfies number
  // @ts-expect-error Nested mutation input is checked.
  mutation.mutate({ id: "wrong" })

  const deep = await orpc.blog.admin.comments.get.useQuery({ id: 1 })
  deep.data.value?.author.name satisfies string | undefined
  // @ts-expect-error Output inference must survive more than two router levels.
  deep.data.value?.author.name satisfies number
  const user = await orpc.blog.users.get.useQuery()
  user.data.value?.name satisfies string | undefined
  // @ts-expect-error Sibling procedures have independent response types.
  void user.data.value?.id
  // @ts-expect-error Missing intermediate router branches are rejected.
  orpc.blog.missing.get.useQuery()
  // @ts-expect-error Missing leaves are rejected.
  orpc.blog.posts.missing.useQuery()
  // @ts-expect-error A router branch is not a query procedure.
  orpc.blog.posts.useQuery()
  // @ts-expect-error A router branch is not a mutation procedure.
  orpc.blog.admin.useMutation()

  const direct = await orpc.blog.posts.get.call({ id: 1 })
  orpc.invalidate() satisfies Promise<void>
  orpc.blog.posts.invalidate() satisfies Promise<void>
  orpc.blog.admin.comments.get.invalidate() satisfies Promise<void>
  orpc.blog.posts.stream.invalidate() satisfies Promise<void>
  await orpc.blog.invalidate.nested.useQuery()
  // @ts-expect-error Procedure invalidation takes no input; it covers all cached inputs.
  orpc.blog.posts.get.invalidate({ id: 1 })
  direct.author.name satisfies string
  orpc.blog.key()
  orpc.blog.posts.key()
  orpc.blog.posts.get.queryKey({ input: { id: 1 } })
  orpc.blog.posts.get.queryOptions({ input: { id: 1 } })
  orpc.blog.posts.get.mutationOptions()
  // @ts-expect-error Upstream utilities retain nested input validation.
  orpc.blog.posts.get.queryOptions({ input: { id: "wrong" } })
  await orpc.blog.useQuery.nested.useQuery()
  await orpc.blog.queryOptions.nested.useQuery()
  const collision = await orpc.blog.useMutation.call()
  collision satisfies string
  // @ts-expect-error Streamed outputs do not gain regular query composables at nested paths.
  orpc.blog.posts.stream.useQuery()
  // @ts-expect-error Streamed outputs do not gain regular mutation composables either.
  orpc.blog.posts.stream.useMutation()
}

/** Verify that wrapping flat or nested clients does not make required context optional. */
function contextInference(raw: {
  get: Client<{ token: string }, void, number, Error>
  blog: {
    posts: {
      get: Client<{ token: string }, { id: number }, { title: string }, Error>
    }
  }
}) {
  const orpc = createORPCNuxtClient(raw)
  // @ts-expect-error Required client context must be provided.
  orpc.get.useQuery()
  orpc.get.useQuery(undefined, {
    context: { token: "token" },
  })
  // @ts-expect-error Required client context also applies to mutations.
  orpc.get.useMutation()
  orpc.get.useMutation({
    context: () => {
      return { token: "token" }
    },
  })

  const query = orpc.blog.posts.get.useQuery(
    { id: 1 },
    {
      context: ref({ token: "token" }),
    },
  )
  query.error.value?.message satisfies string | undefined
  // @ts-expect-error Nested query errors retain their error type.
  void query.error.value?.missing
  // @ts-expect-error Required context cannot be omitted at a nested query.
  orpc.blog.posts.get.useQuery({ id: 1 })
  // @ts-expect-error Required context also applies to the clone overload.
  orpc.blog.posts.get.useQuery({ id: 1 }, { clone: true })
  // @ts-expect-error Required context also applies to the select overload.
  orpc.blog.posts.get.useQuery({ id: 1 }, { select: (post) => post.title })
  orpc.blog.posts.get.useQuery(
    { id: 1 },
    {
      context: { token: "token" },
      clone: true,
    },
  )
  orpc.blog.posts.get.useQuery(
    { id: 1 },
    {
      context: { token: "token" },
      select: (post) => post.title,
    },
  )
  // @ts-expect-error Required context cannot be omitted at a nested mutation.
  orpc.blog.posts.get.useMutation()
  orpc.blog.posts.get.useMutation({
    context: { token: "token" },
    onError: (error) => {
      error.message satisfies string
      // @ts-expect-error Nested mutation errors retain their error type.
      void error.missing
    },
  })
}

void inference
void nestedInference
void contextInference
