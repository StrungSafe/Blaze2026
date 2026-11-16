/**
 * Opens an XO engine on CHIPNET for the contracts' end-to-end scripts. Adapted from server/scripts/_engine.ts.
 *
 * The Electrum client sometimes drops the connection while the engine starts. Its cache is a process-wide singleton
 * that cannot be configured twice, so a retry inside the same process never works: on failure this re-runs the whole
 * script in a fresh process (up to `attempts` times). That is safe because the engine is created before anything is
 * signed or broadcast. The network is hard-coded to chipnet on purpose: these scripts never touch mainnet.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateBip39Mnemonic } from '@bitauth/libauth';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { StorageType } from '@xo-cash/state';

const ATTEMPT_ENV = 'XO_ENGINE_ATTEMPT';

function pause(seconds: number): void {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, seconds * 1000);
}

function rerunInFreshProcess(reason: string, attempts: number): never {
    const attempt = Number(process.env[ATTEMPT_ENV] ?? '1');
    console.error(`  Engine start-up failed (attempt ${attempt}/${attempts}): ${reason}`);

    if (attempt >= attempts) {
        console.error('  Giving up: the chipnet Electrum servers look unreachable. Wait a minute and run the command again.');
        process.exit(1);
    }

    console.error(`  Retrying in a fresh process in ${attempt * 3}s...`);
    pause(attempt * 3);

    const result = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        stdio: 'inherit',
        env: { ...process.env, [ATTEMPT_ENV]: String(attempt + 1) },
    });

    process.exit(result.status ?? 1);
}

/** Reads the test wallet's mnemonic from `folder`, creating a new test wallet the first time. */
export function loadOrCreateMnemonic(folder: string): string {
    const file = join(folder, 'mnemonic.txt');

    mkdirSync(folder, { recursive: true });

    if (!existsSync(file)) {
        const generated = generateBip39Mnemonic();

        if (typeof generated !== 'string') {
            throw new Error('Could not generate a mnemonic.');
        }

        writeFileSync(file, generated, { mode: 0o600 });
        console.log(`Created a new CHIPNET test wallet in ${file} (test money only; keep it out of git).`);
    }

    return readFileSync(file, 'utf8').trim();
}

export async function createChipnetEngine(mnemonic: string, folder: string, attempts = 4): Promise<Engine> {
    // A connection that drops during start-up can surface as an uncaught error rather than a rejected promise.
    const onStartupCrash = (error: unknown): void => rerunInFreshProcess(error instanceof Error ? error.message : String(error), attempts);
    process.once('uncaughtException', onStartupCrash);
    process.once('unhandledRejection', onStartupCrash);

    try {
        const engine = await Engine.create(mnemonic, {
            network: XO_SUPPORTED_NETWORKS.chipnet,
            storageType: StorageType.INDEXEDDB, // SQLITE storage is incomplete in @xo-cash/state 0.0.5
            databasePath: folder,
            databaseFilename: 'XO',
        });

        process.removeListener('uncaughtException', onStartupCrash);
        process.removeListener('unhandledRejection', onStartupCrash);

        return engine;
    } catch (error) {
        return rerunInFreshProcess(error instanceof Error ? error.message : String(error), attempts);
    }
}
