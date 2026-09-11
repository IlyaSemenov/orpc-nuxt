<script setup lang="ts">
const orpc = useOrpc()
const { data: posts } = await orpc.blog.posts.list.useQuery()
</script>

<template>
  <ul>
    <li v-for="post in posts" :key="post.id">{{ post.title }}</li>
  </ul>
</template>
