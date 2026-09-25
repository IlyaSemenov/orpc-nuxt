import { readFile } from "node:fs/promises"
import { dirname, extname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { expect, test } from "vitest"

const packageRoot = fileURLToPath(new URL("../..", import.meta.url))
const entries = ["client", "testing"]

test.each(entries)("keeps the %s entry free of Nuxt runtime imports", async (entry) => {
  // Scan source so the regular test command does not depend on a preceding package build.
  const pending = [resolve(packageRoot, `src/runtime/${entry}.ts`)]
  const visited = new Set<string>()

  while (pending.length > 0) {
    const file = pending.pop()!
    if (visited.has(file)) continue
    visited.add(file)

    const source = await readFile(file, "utf8")
    const imports = [...source.matchAll(/(?:from\s*|import\s*(?:\(\s*)?)["']([^"']+)["']/g)].map(
      (match) => match[1]!,
    )
    const nuxtRuntimeImport = imports.find(
      (specifier) =>
        specifier === "nuxt/app" ||
        specifier.startsWith("nuxt/app/") ||
        specifier.startsWith("#app") ||
        specifier === "#imports",
    )
    expect(nuxtRuntimeImport, file).toBeUndefined()

    for (const specifier of imports) {
      const imported = resolvePackageImport(file, specifier)
      if (imported) pending.push(imported)
    }
  }
})

/** Resolve imports owned by this package while leaving external dependencies outside its graph. */
function resolvePackageImport(importer: string, specifier: string) {
  let imported: string
  if (specifier.startsWith(".")) {
    imported = resolve(dirname(importer), specifier)
  } else if (specifier.startsWith("orpc-vue/")) {
    imported = resolve(packageRoot, "src/runtime", specifier.slice("orpc-vue/".length))
  } else if (specifier === "orpc-vue") {
    imported = resolve(packageRoot, "src/runtime/client")
  } else {
    return undefined
  }
  return extname(imported) ? imported : `${imported}.ts`
}
