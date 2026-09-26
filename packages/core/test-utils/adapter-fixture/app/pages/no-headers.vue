<script setup lang="ts">
const rpc = useRpc()
const { data } = await rpc.hello.useQuery()
</script>

<template>
  <p id="viewer">{{ data?.name }}</p>
  <p id="cookie">{{ data?.cookie }}</p>
</template>
