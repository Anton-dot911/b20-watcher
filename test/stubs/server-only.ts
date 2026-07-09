// Test stub for the `server-only` marker package.
//
// The real `server-only` package throws on import outside a React Server
// Component graph (it has no `react-server` export condition in plain Node).
// Vitest runs in Node, so importing it directly would crash. `vitest.config.ts`
// aliases `server-only` to this empty module so server-only files can be unit
// tested while the real marker still guards the browser bundle in `next build`.
export {};
