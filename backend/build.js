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
  format: 'esm',
  outfile: 'dist/index.js',
  external: nodeBuiltins,
  sourcemap: true,
  minify: false,
  logLevel: 'info',
  banner: {
    js: `
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
    `.trim(),
  },
});

console.log('Build complete!');
