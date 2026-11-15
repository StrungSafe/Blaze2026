import { build } from 'esbuild';
import { mkdirSync, copyFileSync } from 'node:fs';

mkdirSync('dist', { recursive: true });
await build({
    entryPoints: ['src/probe.ts', 'src/spend.ts'],
    bundle: true,
    format: 'esm',
    outdir: 'dist',
    platform: 'browser',
    target: 'es2022',
    define: { global: 'globalThis' },
    logLevel: 'info',
});
copyFileSync('index.html', 'dist/index.html');
copyFileSync('spend.html', 'dist/spend.html');
