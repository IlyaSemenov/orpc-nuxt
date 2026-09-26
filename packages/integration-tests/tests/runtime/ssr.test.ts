import { expect, test } from "bun:test"

import { dehydrate, hydrate, VueQueryPlugin } from "@tanstack/vue-query"
import { renderToString } from "@vue/server-renderer"
import { parse, stringify } from "devalue"
import { createSSRApp, h } from "vue"

import { fixture } from "./fixture"

test("two simultaneous SSR requests isolate both clients and transfer one fresh cache", async () => {
  async function render(viewer: string, state?: ReturnType<typeof dehydrate>) {
    const f = fixture(viewer)
    try {
      if (state) hydrate(f.queryClient, state)
      const app = createSSRApp({
        setup() {
          const t = f.trpc.blog.get.useQuery({ id: 1 })
          const o = f.orpc.blog.get.useQuery({ id: 1 })
          return () => h("p", `${t.data.value?.title} / ${o.data.value?.title}`)
        },
      })
      app.use(VueQueryPlugin, { queryClient: f.queryClient })
      const html = await renderToString(app)
      return { html, state: parse(stringify(dehydrate(f.queryClient))) }
    } finally {
      f.dispose()
    }
  }
  const [alice, bob] = await Promise.all([render("alice"), render("bob")])
  expect(alice.html).toBe("<p>trpc alice / orpc alice</p>")
  expect(bob.html).toBe("<p>trpc bob / orpc bob</p>")
  expect(alice.state.queries).toHaveLength(2)
  expect((await render("must not refetch", alice.state)).html).toBe(alice.html)
})
