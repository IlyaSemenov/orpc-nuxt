---
"orpc-nuxt": patch
---

`createTestORPCClient()` now owns a QueryClient that never retries, exposes it as `queryClient`, and clears it from `reset()`.
