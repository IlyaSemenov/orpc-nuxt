<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query"

const orpc = useOrpc()
const key = orpc.blog.posts.get.queryKey({ input: { id: 1 } })
useQueryClient().setQueryData(key, { id: 1, details: { title: "cached" } })
const invalidated = ref(false)

/** Invoke the helper from a browser event before this app has created any query or mutation. */
async function invalidate() {
  await orpc.blog.posts.invalidate()
  // Reading without Vue injection must find the cache that Vue Query provides during setup.
  invalidated.value = useOrpcQueryClient().getQueryState(key)?.isInvalidated === true
}
</script>

<template>
  <button id="invalidate" @click="invalidate">Invalidate cached posts</button>
  <p id="invalidated">{{ invalidated }}</p>
</template>
