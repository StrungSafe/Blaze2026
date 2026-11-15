/**
 * Claim-Code Voucher on CHIPNET (test coins only), using the wallet kept by chipnet-send.ts in .xo-demo/.
 *
 *     HUB_URL=http://localhost:3000 npx tsx scripts/chipnet-voucher.ts issue          # locks 5000 sats, prints the code
 *     HUB_URL=http://localhost:3000 npx tsx scripts/chipnet-voucher.ts claim <code>   # spends it by revealing the code
 *
 * The wallet needs chipnet funds first (run chipnet-send.ts once). This script refuses any network but chipnet.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import { getTemplateLockingScriptOrThrow, DUST_LIMIT_SATOSHIS } from '@xo-cash/engine';
import { createChipnetEngine } from './_engine.js';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeInvitation, serializeTemplate } from '@xo-cash/utils';
import { claimVoucherTemplate } from '../src/templates/claim-voucher.js';

const mode = process.argv[2];
const HUB_URL = process.env.HUB_URL?.replace(/\/$/, '');
const VOUCHER_SATS = BigInt(process.env.VOUCHER_SATS ?? '5000');
const FOLDER = join(process.cwd(), '.xo-demo');
const STATE_FILE = join(FOLDER, 'voucher.json');
const P2PKH_ID = 'a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';
const VOUCHER_JSON = serializeTemplate(parseTemplate(JSON.stringify(claimVoucherTemplate)));
const VOUCHER_ID = generateTemplateIdentifier(parseTemplate(VOUCHER_JSON));

if (mode !== 'issue' && mode !== 'claim') {
    console.error('Usage: chipnet-voucher.ts issue | claim <code>');
    process.exit(1);
}

const safe = (_k: string, v: unknown): unknown => (typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? binToHex(v) : v);
const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);

const engine = await createChipnetEngine(readFileSync(join(FOLDER, 'mnemonic.txt'), 'utf8').trim(), FOLDER);

async function importFromHubOrLocal(identifier: string, local: string): Promise<void> {
    let source = local;

    if (HUB_URL) {
        const response = await fetch(`${HUB_URL}/api/templates/${identifier}/raw`);

        if (!response.ok) {
            throw new Error(`Hub returned HTTP ${response.status} for ${identifier.slice(0, 12)}... (is the hub running with the voucher template seeded?)`);
        }

        source = await response.text();
        console.log(`  fetched ${identifier.slice(0, 12)}... from the hub`);
    }

    const imported = await engine.importTemplate(source);

    if (imported.templateIdentifier !== identifier) {
        throw new Error(`Identifier mismatch for ${identifier.slice(0, 12)}...: engine says ${imported.templateIdentifier}`);
    }
}

async function finish(invitationIdentifier: string, label: string): Promise<string> {
    const leftover = await engine.calculateChange(invitationIdentifier);
    const fee = BigInt(await engine.estimateTransactionFee(invitationIdentifier));
    const change = BigInt(leftover.valueSatoshis) - fee;

    console.log(`  leftover ${leftover.valueSatoshis} sats, estimated fee ${fee}, change ${change}`);

    if (change >= BigInt(DUST_LIMIT_SATOSHIS) || leftover.tokens.length > 0) {
        await engine.addChangeToInvitation(invitationIdentifier);
    }

    for (const inputIndex of await engine.listOwnInputIndexes(invitationIdentifier)) {
        await engine.signInvitation(invitationIdentifier, inputIndex);
    }

    console.log(`  missing: ${JSON.stringify(await engine.listMissingRequirements(invitationIdentifier), safe)}`);

    let transactionHash: string;
    let executed: Parameters<typeof serializeInvitation>[0];

    try {
        const result = await engine.executeAction(invitationIdentifier, { broadcastTransaction: true });

        transactionHash = result.builtTransaction.transactionHash;
        executed = result.storedInvitation.invitation;
    } catch (error) {
        // The engine broadcasts first, then releases the reserved coins. Electrum can already have dropped the spent
        // coin from the store by then, so that cleanup throws even though the transaction is on the network.
        if (!(error instanceof Error) || error.name !== 'UnspentOutputNotFoundInStoreError') {
            throw error;
        }

        const stored = await engine.getInvitation(invitationIdentifier);
        const recorded = Object.values(stored?.invitation.result?.transactions ?? {})[0] as { transactionHash?: string } | undefined;

        if (!stored || !recorded?.transactionHash) {
            throw new Error(`The engine's clean-up failed after broadcast and the transaction hash was not recorded: ${error.message}`);
        }

        console.log('  (engine clean-up complained about a coin Electrum had already removed; the broadcast itself went through)');
        transactionHash = recorded.transactionHash;
        executed = stored.invitation;
    }

    const file = join(FOLDER, `invitation-${label}-${invitationIdentifier}-executed.json`);

    writeFileSync(file, serializeInvitation(executed));
    console.log(`  BROADCAST ${transactionHash}\n  invitation saved: ${file}`);

    return transactionHash;
}

try {
    step('Importing templates');
    await importFromHubOrLocal(P2PKH_ID, serializeTemplate(p2pkhTemplate));
    await importFromHubOrLocal(VOUCHER_ID, VOUCHER_JSON);
    await engine.setDefaultPolicies({ change: { templateIdentifier: P2PKH_ID }, receive: { templateIdentifier: P2PKH_ID }, address: { templateIdentifier: P2PKH_ID } });

    if (mode === 'issue') {
        const spendable = (await engine.listSpendableUnspentOutputs()).sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)));
        const funded = spendable[0];

        if (!funded || BigInt(funded.valueSatoshis) < VOUCHER_SATS + 1000n) {
            throw new Error('No chipnet funds. Run chipnet-send.ts first to fund the wallet.');
        }

        // The code is random bytes. The lock holds only its SHA-256 hash, and the hash travels as HEX text: raw bytes
        // here would compile to a different script and strand the funds.
        const code = randomBytes(16);
        const codeHash = sha256.hash(code);

        step(`Creating voucher invitation for ${VOUCHER_SATS} sats`);

        const template = await engine.getTemplate(VOUCHER_ID);
        const intent = template?.start?.find((entry) => entry.action === 'createVoucher');

        if (!intent) {
            throw new Error('createVoucher start intent not found.');
        }

        const created = await engine.createInvitation({
            templateIdentifier: VOUCHER_ID,
            actionIdentifier: 'createVoucher',
            intent,
            variables: [
                { variableIdentifier: 'voucherSatoshis', roleIdentifier: 'issuer', value: VOUCHER_SATS },
                { variableIdentifier: 'codeHash', roleIdentifier: 'issuer', value: binToHex(codeHash) },
            ],
            inputs: [{ outpointTransactionHash: hexToBin(funded.outpointTransactionHash), outpointIndex: funded.outpointIndex }],
        });
        const { invitationIdentifier } = created.invitation;

        console.log(`  invitation ${invitationIdentifier}`);
        console.log(`  missing: ${JSON.stringify(await engine.listMissingRequirements(invitationIdentifier), safe)}`);

        step('Adding the voucher output');
        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: VOUCHER_ID,
            actionIdentifier: 'createVoucher',
            outputs: [{ outputIdentifier: 'voucherOutput', roleIdentifier: 'claimer' }],
        });

        step('Change, sign, broadcast');

        // Saved before broadcasting so the claim code can never be lost, whatever happens next.
        writeFileSync(join(FOLDER, 'voucher-code.txt'), `${binToHex(code)}\n`);
        console.log(`  claim code saved to ${join(FOLDER, 'voucher-code.txt')}`);

        const transactionHash = await finish(invitationIdentifier, 'createVoucher');

        writeFileSync(STATE_FILE, JSON.stringify({ transactionHash, outputIndex: 0, satoshis: VOUCHER_SATS.toString(), codeHash: binToHex(codeHash) }, null, 2));
        console.log(`\nVOUCHER CREATED. Claim code (keep it): ${binToHex(code)}`);
        console.log(`Claim it with:  HUB_URL=${HUB_URL ?? 'http://localhost:3000'} npx tsx scripts/chipnet-voucher.ts claim ${binToHex(code)}`);
    } else {
        const codeHex = process.argv[3];

        if (!codeHex || !/^[0-9a-f]{32}$/i.test(codeHex)) {
            throw new Error('Give the 32-character claim code printed by "issue".');
        }

        if (!existsSync(STATE_FILE)) {
            throw new Error('No voucher.json: run "issue" first.');
        }

        const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as { transactionHash: string; outputIndex: number; codeHash: string };

        if (binToHex(sha256.hash(hexToBin(codeHex))) !== state.codeHash) {
            throw new Error('That code does not match the voucher hash, so the claim would fail on-chain. Nothing was sent.');
        }

        step('Looking for the voucher output');

        const tracked = (await engine.listUnspentOutputs()).find((output) => output.outpointTransactionHash === state.transactionHash && output.outpointIndex === state.outputIndex);

        console.log(tracked ? '  the engine tracks the voucher output' : '  the engine does not list it as unspent yet; trying the outpoint directly');

        step('Creating claim invitation (revealing the code)');

        const template = await engine.getTemplate(VOUCHER_ID);

        if (!template) {
            throw new Error('Template missing.');
        }

        const lock = getTemplateLockingScriptOrThrow(template, 'voucherLockingScript');
        const intent = lock.roles?.claimer?.actions?.find((entry) => entry.action === 'claimVoucher');

        if (!intent) {
            throw new Error('claimVoucher follow-up intent not found on the voucher locking script.');
        }

        const created = await engine.createInvitation({
            templateIdentifier: VOUCHER_ID,
            actionIdentifier: 'claimVoucher',
            intent,
            variables: [
                { variableIdentifier: 'claimCode', roleIdentifier: 'claimer', value: codeHex.toLowerCase() },
                { variableIdentifier: 'codeHash', roleIdentifier: 'claimer', value: state.codeHash },
            ],
            inputs: [{ inputIdentifier: 'voucherInput', outpointTransactionHash: hexToBin(state.transactionHash), outpointIndex: state.outputIndex }],
        });
        const { invitationIdentifier } = created.invitation;

        console.log(`  invitation ${invitationIdentifier}`);
        step('Change, sign, broadcast');
        await finish(invitationIdentifier, 'claimVoucher');
        console.log('\nVOUCHER CLAIMED. The code is now public on-chain, so this voucher is spent.');
    }
} catch (error) {
    const e = error as Error & { cause?: unknown };

    console.error(`\nFAILED at the step above: ${e.name}: ${e.message}`);

    if (e.cause) {
        console.error(`cause: ${e.cause instanceof Error ? `${e.cause.name}: ${e.cause.message}` : String(e.cause)}`);
    }

    process.exitCode = 1;
} finally {
    await engine.stop().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
}
