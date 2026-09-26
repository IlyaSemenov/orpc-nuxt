# RPC Vue & Nuxt integrations

A monorepo for RPC integrations with Vue, TanStack Query, and Nuxt.

- [orpc-vue](packages/orpc-vue/README.md): for [oRPC](https://orpc.dev/) in Vue and Nuxt.
- [trpc-vue](packages/trpc-vue/README.md): for [tRPC](https://trpc.io/) in Vue and Nuxt.

## Development

Install dependencies with `bun install` from the repository root.
Run the complete workspace checks in this order:

```sh
bun run build
bun run types
bun run test
bun run test:component
bunx playwright install chromium-headless-shell
bun run test:nuxt
```

`bun run test` runs the core, adapter and [cross-adapter integration](packages/integration-tests/README.md) runtime tests.
`bun run test:nuxt` checks each adapter's archive separately and both archives together in isolated Nuxt applications.
Use `bun run test`, not `bun test`: the package scripts select the appropriate files for each test runner.
