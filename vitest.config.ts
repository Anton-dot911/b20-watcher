import path from "node:path";

import { defineConfig } from "vitest/config";

// The `server-only` package intentionally throws when imported outside a React
// Server Component graph. Our server-only modules (lib/cdp-sql.ts, etc.) import
// it, so we alias it to an empty stub for unit tests. `next build` still sees
// the real package and enforces the server-only boundary in the client bundle.
export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve("./test/stubs/server-only.ts"),
    },
  },
  test: {
    environment: "node",
  },
});
