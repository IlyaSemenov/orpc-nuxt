<script setup lang="ts">
import { useQueryClient } from "@tanstack/vue-query"

const rpc = useRpc()
const key = usePostKey(1)
useQueryClient().setQueryData(key, { id: 1, details: { title: "cached" } })
const invalidated = ref(false)

/** Invoke the helper from a browser event before this app has created any query or mutation. */
async function invalidate() {
  await rpc.blog.posts.invalidate()
  // Reading without Vue injection must find the cache that Vue Query provides during setup.
  invalidated.value = useRpcQueryClient().getQueryState(key)?.isInvalidated === true
}
</script>

<template>
  <button id="invalidate" @click="invalidate">Invalidate cached posts</button>
  <p id="invalidated">{{ invalidated }}</p>
</template>
