/**
 * Dev-only invitation tool for the XO templates in this workspace (see web/README.md).
 *
 * Everything runs in the browser. XO's engine is used unchanged, but its state package statically imports Node-only
 * modules for the SQLite store this tool never opens, so those resolve to small stand-ins in web/stubs/.
 */
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const here = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    root: here('.'),
    plugins: [react(), tailwindcss()],
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            fs: here('stubs/fs.ts'),
            path: here('stubs/path.ts'),
            // The engine's Electrum application imports node:path for its own cache file, also never used here.
            'node:path': here('stubs/path.ts'),
            'better-sqlite3': here('stubs/better-sqlite3.ts'),
            indexeddbshim: here('stubs/indexeddbshim.ts'),
        },
    },
    server: {
        host: '127.0.0.1',
        port: 5180,
        strictPort: true,
        // The app reads template.json files from the system folders next to web/.
        fs: { allow: [here('..')] },
    },
    build: {
        outDir: here('dist'),
        emptyOutDir: true,
        target: 'es2022',
    },
});
