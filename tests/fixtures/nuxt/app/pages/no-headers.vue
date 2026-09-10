<script setup lang="ts">
const orpc = useOrpc()
const { data } = await orpc.hello.useQuery()
</script>

<template>
  <p id="viewer">{{ data?.name }}</p>
  <p id="cookie">{{ data?.cookie }}</p>
</template>
