# orpc-nuxt

## 0.2.0

### Minor Changes

- 5b3908a: Add the auto-imported `useOrpcQueryClient()`, which returns the app's QueryClient and also works outside Vue components.
- aa9d708: Accept later oRPC 2.0.0 betas: `@orpc/client` and `@orpc/tanstack-query` now allow `^2.0.0-beta.35` instead of that exact version.

## 0.1.1

### Patch Changes

- ac187ab: Support Nuxt 3.14 and later, and accept the `@nuxt/kit` and `devalue` versions that the host Nuxt installs.

## 0.1.0

### Minor Changes

- 47bb193: Add oRPC v2 integration for Nuxt 3 and 4 with a typed HTTP plugin helper, reactive, awaitable queries, mutations, SSR hydration, and configurable caching.
  Support local mutable clones, readonly selections, and invalidation of procedures or router branches.
