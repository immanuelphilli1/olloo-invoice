import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/jobs/runReminders.ts'],
  format: 'esm',
  target: 'node22',
  platform: 'node',
  // shared is TypeScript source, so bundle it; everything else stays in node_modules
  noExternal: ['@olloo/shared'],
  clean: true,
  sourcemap: true,
});
