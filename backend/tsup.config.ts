import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/server.ts', 'src/scripts/seed.ts', 'src/scripts/createAdmin.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node20',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  splitting: true,
  // Shared package ships TypeScript source — bundle it in; keep real deps external.
  noExternal: ['@playlocal/shared'],
});
