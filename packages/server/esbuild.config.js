import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [
    'express',
    'postgres',
    'drizzle-orm',
    'awilix',
    'zod',
    '@todos/schema',
  ],
  minify: false,
  sourcemap: true,
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
`,
  },
});
