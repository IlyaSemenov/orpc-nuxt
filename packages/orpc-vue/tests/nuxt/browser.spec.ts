import { defineBrowserTests } from "@rpc-vue/core/test-utils/browser-tests"

defineBrowserTests("/orpc/", (path) => [path.replaceAll("/", ".")])
