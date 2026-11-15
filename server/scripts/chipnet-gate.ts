/**
 * Chipnet gate check for the hub. Run it on a machine with internet access:
 *
 *     npx tsx scripts/chipnet-gate.ts                       # uses a throwaway wallet, needs no funds
 *     HUB_URL=http://localhost:3000 npx tsx scripts/chipnet-gate.ts   # also fetches a template from your running hub
 *
 * It answers three questions, printing PASS or FAIL for each:
 *   1. Does Engine.create connect to chipnet Electrum servers?
 *   2. Does the engine compute the SAME template identifier as the hub (so "fetch by identifier" is trustworthy)?
 *   3. Can the engine create an invitation from a hub template? (The invitation JSON is printed so it can be pasted
 *      into the Blaze Tool for the Build with XO bounty check.)
 * The wallet is random and holds nothing. Nothing is broadcast.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { generateBip39Mnemonic } from '@bitauth/libauth';
import { Engine, XO_SUPPORTED_NETWORKS } from '@xo-cash/engine';
import { StorageType } from '@xo-cash/state';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';

const HUB_URL = process.env.HUB_URL?.replace(/\/$/, '');
const TIMEOUT_MS = 90_000;
let failures = 0;

const report = (ok: boolean, label: string, detail = ''): void => {
    failures += ok ? 0 : 1;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? `\n      ${detail}` : ''}`);
};

const withTimeout = <T>(promise: Promise<T>, label: string): Promise<T> =>
    Promise.race([promise, new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${TIMEOUT_MS / 1000}s`)), TIMEOUT_MS))]);

const folder = mkdtempSync(join(tmpdir(), 'xo-gate-'));
const mnemonic = generateBip39Mnemonic();

if (typeof mnemonic === 'string' && mnemonic.includes('Error')) {
    throw new Error(mnemonic);
}

let engine: Engine | undefined;

try {
    engine = await withTimeout(
        Engine.create(mnemonic as string, {
            network: XO_SUPPORTED_NETWORKS.chipnet,
            // SQLITE storage in @xo-cash/state 0.0.5/0.0.6 only implements templates, so the engine fails with
            // "listScriptHashes is not a function". IndexedDB (through indexeddbshim in Node) is the complete backend.
            storageType: StorageType.INDEXEDDB,
            databasePath: folder,
            databaseFilename: 'XO',
        }),
        'Engine.create',
    );
    report(true, 'Engine.create on chipnet');

    const servers = engine.listElectrumConnections();

    console.log(`      Electrum connections: ${servers.length}`);

    // 2. The engine and the hub must agree on identifiers.
    const expected = generateTemplateIdentifier(parseTemplate(serializeTemplate(p2pkhTemplate)));
    const local = await engine.importTemplate(p2pkhTemplate);

    report(local.templateIdentifier === expected, 'Engine identifier equals the hub rule (p2pkh)', `engine ${local.templateIdentifier}\n      hub    ${expected}`);

    let templateIdentifier = local.templateIdentifier;

    // 3a. Optionally pull a template from the running hub and make sure the engine accepts it unchanged.
    if (HUB_URL) {
        const response = await fetch(`${HUB_URL}/api/templates/${expected}/raw`);
        const raw = await response.text();

        report(response.ok, `Hub served /api/templates/${expected.slice(0, 12)}.../raw`, `HTTP ${response.status}`);

        if (response.ok) {
            const imported = await engine.importTemplate(raw);

            report(imported.templateIdentifier === expected, 'Engine imports the hub JSON and gets the same identifier');
            templateIdentifier = imported.templateIdentifier;
        }
    }

    // 3b. Create an invitation from the template.
    const template = await engine.getTemplate(templateIdentifier);
    const starts = template?.start ?? [];

    report(starts.length > 0, `Template has starting actions`, starts.map((s) => s.action).join(', '));

    const first = starts[0];

    if (first) {
        const stored = await engine.createInvitation({ templateIdentifier, actionIdentifier: first.action, intent: first });

        report(Boolean(stored), `createInvitation for action "${first.action}"`);
        console.log('\n--- invitation (paste into the Blaze Tool to check it opens) ---');
        console.log(JSON.stringify(stored, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? Buffer.from(v).toString('hex') : v), 2));
    }
} catch (error) {
    report(false, 'Gate run stopped', error instanceof Error ? error.message : String(error));
} finally {
    await engine?.stop().catch(() => undefined);
    rmSync(folder, { recursive: true, force: true });
}

console.log(failures === 0 ? '\nAll gate checks passed.' : `\n${failures} check(s) failed. Paste this whole output back.`);
process.exit(failures === 0 ? 0 : 1);
