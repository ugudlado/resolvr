import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: 'dist/index.js',
  external: ['drizzle-orm', 'zod', 'postgres', '@neondatabase/serverless'],
  minify: false,
  sourcemap: true,
});
