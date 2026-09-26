const trpc = useNuxtApp().$trpc
const orpc = useNuxtApp().$orpc
const t: Promise<{ id: number; title: string; cookie: string; date: Date }> =
  trpc.blog.posts.get.query({ id: 1 })
const o: Promise<{ id: number; title: string; cookie: string; date: Date }> =
  orpc.blog.posts.get.call({ id: 1 })
// @ts-expect-error Mixed injections must retain both routers' input types.
trpc.blog.posts.get.query({ id: "bad" })
// @ts-expect-error Mixed injections must retain both routers' input types.
orpc.blog.posts.get.call({ id: "bad" })
void [t, o]
