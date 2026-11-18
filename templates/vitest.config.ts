import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const local = (name: string): string => fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

export default defineConfig({
    resolve: {
        // Tests import the registry's audit from ../server/src/audit. Resolve its packages from this workspace, so one
        // copy of each (with the same pinned versions) is loaded and server/ needs no install of its own.
        alias: {
            '@xo-cash/engine': local('@xo-cash/engine'),
            '@xo-cash/utils': local('@xo-cash/utils'),
            '@bitauth/libauth': local('@bitauth/libauth'),
        },
    },
    test: {
        include: ['*/test/**/*.test.ts'],
        exclude: ['node_modules/**', '_skeleton/**'],
        testTimeout: 20000,
    },
});
