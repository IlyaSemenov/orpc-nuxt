# orpc-nuxt Agent Guide

## Overview

oRPC integration for Nuxt.

Read [packages/orpc-nuxt/README.md](packages/orpc-nuxt/README.md) completely before changing the public API, package behavior, supported runtimes, or user documentation.

Extend this guide only with stable, non-obvious conventions, architecture, contracts, workflows, and gotchas.
Do not catalog files or restate information evident from their names and locations.

## Scope

- Keep production code in each package's `src/`.
- Keep focused module tests beside their source as `*.test.ts`.
- Keep runtime integration tests in each package's `tests/runtime/` and source type tests in its `tests/types/`.
- Keep Nuxt component tests in the fixture application's `test/nuxt/`, where its generated tsconfig also typechecks them.
- Name compile-only tests `*.type-test.ts`; keep Nuxt type tests inside the fixture application so they use its generated injections and built package declarations.
- Keep compile-only checks that reuse a component test's fixtures in that test file rather than a separate `*.type-test.ts`.
- Keep package `src/index.ts` files limited to explicit public exports.
- Treat package `package.json` exports and supported runtimes as public contracts.

## Implementation

- Build query and mutation options with the official oRPC utilities, preserving their keys and client context.
- Register Vue lifecycle hooks before awaiting query completion.
- Capture QueryClient during plugin initialization; `.invalidate()` must not require Vue injection at call time.
- Keep the client entrypoint free of Nuxt runtime imports.
- Write Nuxt plugin ordering metadata as literals in generated plugin source.
- Use extensionless relative imports in package `src/` files.

## Documentation

- Write public README and JSDoc text for package users who do not know the implementation.
- Add JSDoc to every exported declaration and to internal helpers whose contract, inputs, output, or failure behavior is not obvious.
- Add inline comments beside every non-obvious invariant, algorithmic choice, safety constraint, and intentionally limited behavior.
- Update nearby JSDoc and inline comments whenever the documented code changes, and remove comments that no longer apply.
- Do not narrate self-evident syntax or restate what a name already communicates.
- Do not document obvious or implied defaults.
- Describe a default only when readers need it to make a decision or avoid surprising behavior.
- Use One Sentence Per Line for connected prose.
- Keep semantically connected explanations as prose paragraphs.
- Use lists for separate assertions instead of presenting them as prose paragraphs.

## Changesets

- Before the first publication, update `.changeset/initial-release.md` instead of creating additional changesets.
- After the first publication, add one `.changeset/*.md` file for each independently releasable user-visible change.
- Include every affected public package and its SemVer bump in the changeset frontmatter.
- Do not add changesets for internal refactors, maintenance, tests, or documentation changes that do not require a package release.
- Choose the SemVer bump from the public contract: `patch` for backward-compatible fixes and `minor` for backward-compatible functionality.
- Before 1.0, use `minor` for breaking changes; starting with 1.0, use `major` and remove this rule.
- Create `.changeset/<unique-name>.md` with this format, adding a frontmatter entry for every affected public package:

```markdown
---
"<package-name>": patch
---

Describe the user-visible change.
```

- Briefly describe the user-observable change or new capability in the public contract, without implementation details or rationale.
  Prefer a single sentence.
- Do not edit the package version or `CHANGELOG.md` by hand, and do not run `changeset version` or `changeset publish`; the release workflow consumes pending changesets.

## Tests

- Test deeply nested router inference through `useOrpc()` and `$orpc`, with valid and invalid calls against source types and built declarations.
- Add a `describe` block where the file gives a reason for it: several APIs or behaviors in one file, or a fixture that belongs to some cases but not all.
  Name such a block after what it covers and keep its fixtures inside it.
- Distinguish several same-kind values by role rather than by order.
  When values differ only by order, number them with digits instead of ordinal words.
- Keep tests deterministic so a failure repeats on every run.
  Generate random inputs from an explicit seed and print the seed in failure messages so the failing input can be replayed.

## Checks

- Run package checks from that package's directory or use root scripts to check every workspace package.
- Build and publish each package from its own directory.

- Run the `types` script when public types or TypeScript configuration change.
- Run the `test` script when behavior changes.
- Run the `build` script when package exports, declarations, or supported runtimes change.
- Run `test:component` when changing composables, auto-imports, or a documented testing recipe; it uses the built package, so build first.
- Run `test:nuxt` when changing Nuxt compatibility, plugin registration, or SSR hydration.
  Install the packed archive in an isolated consumer running the exact Nuxt version installed in the workspace; keep its generated configuration and dependencies outside the source workspace.
  Check other Nuxt versions only on explicit request, by passing them to `test:nuxt`.
