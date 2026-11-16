/**
 * Revenue Split on CHIPNET (test coins only), through the XO engine: fund a split, then pay it out.
 *
 *     npx tsx revenue-split/scripts/chipnet.ts fund      # locks SPLIT_SATS (default 10000) in a new split
 *     npx tsx revenue-split/scripts/chipnet.ts payout    # pays that split out to its three recipients
 *
 * The test wallet lives in contracts/.xo-demo (gitignored). On the first run, `fund` prints a chipnet address and
 * waits for coins from a faucet (https://tbch.googol.cash/ or https://chipnet.bch.ninja/).
 *
 * The three recipients are fresh receive addresses of this same wallet, so every share comes back to it. The split
 * is 60% artist, 25% collaborator, 15% platform. Invitations are saved as JSON for the Blaze Tool (blaze.xo.cash, set
 * to chipnet, import template.json first).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { DUST_LIMIT_SATOSHIS, getTemplateLockingScriptOrThrow, type Engine } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeInvitation, serializeTemplate } from '@xo-cash/utils';
import { createChipnetEngine, loadOrCreateMnemonic } from '../../shared/chipnet-engine.js';

const mode = process.argv[2];
const FOLDER = join(import.meta.dirname, '..', '..', '.xo-demo');
const STATE_FILE = join(FOLDER, 'revenue-split.json');
const SPLIT_SATS = BigInt(process.env.SPLIT_SATS ?? '10000');
const WAIT_MINUTES = Number(process.env.WAIT_MINUTES ?? '10');
const ARTIST_BASIS_POINTS = 6000n;
const COLLABORATOR_BASIS_POINTS = 2500n;

const TEMPLATE_JSON = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');
const TEMPLATE_ID = generateTemplateIdentifier(parseTemplate(TEMPLATE_JSON));
const P2PKH_JSON = serializeTemplate(p2pkhTemplate);

interface SplitState {
    fundTransactionHash: string;
    outputIndex: number;
    splitSatoshis: string;
    artistPublicKeyHash: string;
    collaboratorPublicKeyHash: string;
    platformPublicKeyHash: string;
    payoutTransactionHash?: string;
}

if (mode !== 'fund' && mode !== 'payout') {
    console.error('Usage: chipnet.ts fund | payout');
    process.exit(1);
}

const safe = (_key: string, value: unknown): unknown => (typeof value === 'bigint' ? `${value}n` : value instanceof Uint8Array ? binToHex(value) : value);
const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);
const total = (outputs: { valueSatoshis: bigint | number | string }[]): bigint => outputs.reduce((sum, output) => sum + BigInt(output.valueSatoshis), 0n);

const engine = await createChipnetEngine(loadOrCreateMnemonic(FOLDER), FOLDER);

/** A fresh P2PKH receive address of this wallet, as its 20-byte public key hash in hex. */
async function walletPublicKeyHash(): Promise<string> {
    const lockingBytecode = await engine.generateLockingBytecodeFromDefaultPolicy('receive');

    if (!/^76a914[0-9a-f]{40}88ac$/.test(lockingBytecode)) {
        throw new Error(`Expected a P2PKH receive script, got ${lockingBytecode}`);
    }

    return lockingBytecode.slice(6, 46);
}

/** Waits until the wallet holds at least `needed` spendable satoshis, printing a funding address if it does not. */
async function waitForFunds(needed: bigint): Promise<void> {
    if (total(await engine.listSpendableUnspentOutputs()) >= needed) {
        return;
    }

    const address = lockingBytecodeToCashAddress({ bytecode: hexToBin(await engine.generateLockingBytecodeFromDefaultPolicy('receive')), prefix: 'bchtest' });

    if (typeof address === 'string') {
        throw new Error(address);
    }

    console.log(`\nFund this CHIPNET address with at least ${needed} satoshis:\n\n    ${address.address}\n`);
    console.log(`Faucets: https://tbch.googol.cash/  or  https://chipnet.bch.ninja/. Waiting up to ${WAIT_MINUTES} minutes...`);

    const deadline = Date.now() + WAIT_MINUTES * 60_000;

    while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 5000));

        if (total(await engine.listSpendableUnspentOutputs()) >= needed) {
            return;
        }
    }

    process.exitCode = 2;
    throw new Error('No funds arrived. Fund the address above and run the command again (the wallet is kept).');
}

/** Adds change, signs this wallet's inputs, broadcasts, and saves the executed invitation. */
async function finish(activeEngine: Engine, invitationIdentifier: string, label: string): Promise<string> {
    const leftover = await activeEngine.calculateChange(invitationIdentifier);
    const fee = BigInt(await activeEngine.estimateTransactionFee(invitationIdentifier));
    const change = BigInt(leftover.valueSatoshis) - fee;

    console.log(`  leftover ${leftover.valueSatoshis} sats, estimated fee ${fee}, change ${change}`);

    if (change >= BigInt(DUST_LIMIT_SATOSHIS) || leftover.tokens.length > 0) {
        await activeEngine.addChangeToInvitation(invitationIdentifier);
    }

    for (const inputIndex of await activeEngine.listOwnInputIndexes(invitationIdentifier)) {
        await activeEngine.signInvitation(invitationIdentifier, inputIndex);
    }

    console.log(`  missing: ${JSON.stringify(await activeEngine.listMissingRequirements(invitationIdentifier), safe)}`);

    let transactionHash: string;
    let executed: Parameters<typeof serializeInvitation>[0];

    try {
        const result = await activeEngine.executeAction(invitationIdentifier, { broadcastTransaction: true });

        transactionHash = result.builtTransaction.transactionHash;
        executed = result.storedInvitation.invitation;
    } catch (error) {
        // The engine broadcasts first, then releases reserved coins; Electrum may already have dropped the spent coin,
        // so that clean-up can throw after a successful broadcast (see server/scripts/chipnet-voucher.ts).
        if (!(error instanceof Error) || error.name !== 'UnspentOutputNotFoundInStoreError') {
            throw error;
        }

        const stored = await activeEngine.getInvitation(invitationIdentifier);
        const recorded = Object.values(stored?.invitation.result?.transactions ?? {})[0] as { transactionHash?: string } | undefined;

        if (!stored || !recorded?.transactionHash) {
            throw new Error(`Clean-up failed after broadcast and no transaction hash was recorded: ${error.message}`);
        }

        transactionHash = recorded.transactionHash;
        executed = stored.invitation;
    }

    const file = join(FOLDER, `invitation-revenue-split-${label}-${invitationIdentifier}.json`);

    writeFileSync(file, serializeInvitation(executed));
    console.log(`  BROADCAST ${transactionHash}\n  invitation saved: ${file}`);

    return transactionHash;
}

try {
    step('Importing templates');

    const imported = await engine.importTemplate(TEMPLATE_JSON);

    if (imported.templateIdentifier !== TEMPLATE_ID) {
        throw new Error(`Identifier mismatch: engine ${imported.templateIdentifier}, template.json ${TEMPLATE_ID}`);
    }

    const { templateIdentifier: p2pkhIdentifier } = await engine.importTemplate(P2PKH_JSON);

    await engine.setDefaultPolicies({
        change: { templateIdentifier: p2pkhIdentifier },
        receive: { templateIdentifier: p2pkhIdentifier },
        address: { templateIdentifier: p2pkhIdentifier },
    });
    console.log(`  Revenue Split ${TEMPLATE_ID}`);

    const template = await engine.getTemplate(TEMPLATE_ID);

    if (!template) {
        throw new Error('Template missing after import.');
    }

    if (mode === 'fund') {
        await waitForFunds(SPLIT_SATS + 2000n);

        const funding = (await engine.listSpendableUnspentOutputs()).sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        if (!funding || BigInt(funding.valueSatoshis) < SPLIT_SATS + 1000n) {
            throw new Error('No single coin is large enough; consolidate or lower SPLIT_SATS.');
        }

        const recipients = {
            artistPublicKeyHash: await walletPublicKeyHash(),
            collaboratorPublicKeyHash: await walletPublicKeyHash(),
            platformPublicKeyHash: await walletPublicKeyHash(),
        };
        const intent = template.start?.find((entry) => entry.action === 'fundSplit');

        if (!intent) {
            throw new Error('fundSplit start intent not found.');
        }

        step(`Creating the fundSplit invitation for ${SPLIT_SATS} sats`);

        // Key hashes travel as HEX text: raw bytes would compile a different locking script and strand the funds.
        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fundSplit',
            intent,
            variables: [
                { variableIdentifier: 'splitSatoshis', roleIdentifier: 'payer', value: SPLIT_SATS },
                { variableIdentifier: 'artistPublicKeyHash', roleIdentifier: 'payer', value: recipients.artistPublicKeyHash },
                { variableIdentifier: 'collaboratorPublicKeyHash', roleIdentifier: 'payer', value: recipients.collaboratorPublicKeyHash },
                { variableIdentifier: 'platformPublicKeyHash', roleIdentifier: 'payer', value: recipients.platformPublicKeyHash },
                { variableIdentifier: 'artistBasisPoints', roleIdentifier: 'payer', value: ARTIST_BASIS_POINTS },
                { variableIdentifier: 'collaboratorBasisPoints', roleIdentifier: 'payer', value: COLLABORATOR_BASIS_POINTS },
            ],
            inputs: [{ outpointTransactionHash: hexToBin(funding.outpointTransactionHash), outpointIndex: funding.outpointIndex }],
        });
        const { invitationIdentifier } = created.invitation;

        console.log(`  invitation ${invitationIdentifier}`);
        step('Adding the split output (tracked for the trigger role, so this wallet can pay it out later)');
        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fundSplit',
            outputs: [{ outputIdentifier: 'splitOutput', roleIdentifier: 'trigger' }],
        });

        step('Change, sign, broadcast');

        const fundTransactionHash = await finish(engine, invitationIdentifier, 'fundSplit');
        const state: SplitState = { fundTransactionHash, outputIndex: 0, splitSatoshis: SPLIT_SATS.toString(), ...recipients };

        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        console.log(`\nSPLIT FUNDED: ${fundTransactionHash}:0. Pay it out with:  npx tsx revenue-split/scripts/chipnet.ts payout`);
    } else {
        if (!existsSync(STATE_FILE)) {
            throw new Error('No revenue-split.json: run "fund" first.');
        }

        const state = JSON.parse(readFileSync(STATE_FILE, 'utf8')) as SplitState;

        if (state.payoutTransactionHash) {
            throw new Error(`This split was already paid out in ${state.payoutTransactionHash}. Run "fund" for a new one.`);
        }

        const feeCoin = (await engine.listSpendableUnspentOutputs()).find(
            (output) => output.outpointTransactionHash !== state.fundTransactionHash || output.outpointIndex !== state.outputIndex,
        );

        if (!feeCoin) {
            throw new Error('No coin of this wallet is available to pay the payout fee.');
        }

        const intent = getTemplateLockingScriptOrThrow(template, 'revenueSplitLockingScript').roles?.trigger?.actions?.find((entry) => entry.action === 'payout');

        if (!intent) {
            throw new Error('payout intent not found on the split locking script.');
        }

        step('Creating the payout invitation (split coin at input 0, fee coin after it)');

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'payout',
            intent,
            variables: [
                { variableIdentifier: 'splitSatoshis', roleIdentifier: 'trigger', value: BigInt(state.splitSatoshis) },
                { variableIdentifier: 'artistPublicKeyHash', roleIdentifier: 'trigger', value: state.artistPublicKeyHash },
                { variableIdentifier: 'collaboratorPublicKeyHash', roleIdentifier: 'trigger', value: state.collaboratorPublicKeyHash },
                { variableIdentifier: 'platformPublicKeyHash', roleIdentifier: 'trigger', value: state.platformPublicKeyHash },
                { variableIdentifier: 'artistBasisPoints', roleIdentifier: 'trigger', value: ARTIST_BASIS_POINTS },
                { variableIdentifier: 'collaboratorBasisPoints', roleIdentifier: 'trigger', value: COLLABORATOR_BASIS_POINTS },
            ],
            inputs: [
                { inputIdentifier: 'splitInput', outpointTransactionHash: hexToBin(state.fundTransactionHash), outpointIndex: state.outputIndex },
                { outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex },
            ],
        });
        const { invitationIdentifier } = created.invitation;

        console.log(`  invitation ${invitationIdentifier}`);
        step('Adding the three share outputs');
        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'payout',
            outputs: [
                { outputIdentifier: 'artistShareOutput' },
                { outputIdentifier: 'collaboratorShareOutput' },
                { outputIdentifier: 'platformShareOutput' },
            ],
        });

        step('Change, sign, broadcast');

        state.payoutTransactionHash = await finish(engine, invitationIdentifier, 'payout');
        writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
        console.log(`\nSPLIT PAID OUT: ${state.payoutTransactionHash}`);
    }
} catch (error) {
    const failure = error as Error & { cause?: unknown };

    console.error(`\nFAILED at the step above: ${failure.name}: ${failure.message}`);

    if (failure.cause) {
        console.error(`cause: ${failure.cause instanceof Error ? `${failure.cause.name}: ${failure.cause.message}` : String(failure.cause)}`);
    }

    process.exitCode ??= 1;
} finally {
    await engine.stop().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
}
