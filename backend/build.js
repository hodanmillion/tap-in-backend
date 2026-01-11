import { build } from 'esbuild';

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/index.js',
  external: [],
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});

console.log('Build complete!');
