import { build } from 'esbuild';

const nodeBuiltins = [
  'stream',
  'events',
  'http',
  'https',
  'crypto',
  'zlib',
  'os',
  'path',
  'fs',
  'util',
  'url',
  'net',
  'tls',
  'buffer',
  'string_decoder',
  'assert',
  'module',
];

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: 'dist/index.cjs',
  external: nodeBuiltins,
  sourcemap: true,
  minify: false,
  logLevel: 'info',
});

console.log('Build complete!');
