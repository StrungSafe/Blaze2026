/**
 * Opens the demo wallet's engine on chipnet.
 *
 * The Electrum client sometimes drops the connection while the engine is starting ("Connection lost"). Its cache is a
 * process-wide singleton that cannot be configured twice, so retrying inside the same process never works. Instead,
 * when start-up fails, this re-runs the whole script in a fresh process (up to `attempts` times). That is safe because
 * the engine is always created before anything is signed or broadcast.
 */
import { spawnSync } from 'node:child_process';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { StorageType } from '@xo-cash/state';

const ATTEMPT_ENV = 'XO_ENGINE_ATTEMPT';

function rerunInFreshProcess(reason: string, attempts: number): never {
    const attempt = Number(process.env[ATTEMPT_ENV] ?? '1');
    console.error(`  Engine start-up failed (attempt ${attempt}/${attempts}): ${reason}`);

    if (attempt >= attempts) {
        console.error('  Giving up: the chipnet Electrum servers look unreachable. Wait a minute and run the command again.');
        process.exit(1);
    }

    const waitSeconds = attempt * 3;
    console.error(`  Retrying in a fresh process in ${waitSeconds}s...`);
    spawnSync('sleep', [String(waitSeconds)]);

    const result = spawnSync(process.execPath, [...process.execArgv, ...process.argv.slice(1)], {
        stdio: 'inherit',
        env: { ...process.env, [ATTEMPT_ENV]: String(attempt + 1) },
    });

    process.exit(result.status ?? 1);
}

export async function createChipnetEngine(mnemonic: string, folder: string, attempts = 4): Promise<Engine> {
    // A connection that drops during start-up can surface as an uncaught error rather than a rejected promise.
    const onStartupCrash = (error: unknown): void => rerunInFreshProcess(error instanceof Error ? error.message : String(error), attempts);
    process.once('uncaughtException', onStartupCrash);
    process.once('unhandledRejection', onStartupCrash);

    try {
        const engine = await Engine.create(mnemonic, {
            network: XO_SUPPORTED_NETWORKS.chipnet, // hard-coded on purpose: these scripts never touch mainnet
            storageType: StorageType.INDEXEDDB, // SQLITE storage is incomplete in @xo-cash/state 0.0.5/0.0.6
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
