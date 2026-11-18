/**
 * Drip Mine on CHIPNET (test coins only), through the XO engine.
 *
 *     npx tsx drip-mine/scripts/chipnet.ts fund       # XO action fund: FUND_SATS (default 700) to the Drip Mine
 *     npx tsx drip-mine/scripts/chipnet.ts drip       # XO action drip on one Drip Mine coin above 740 sats
 *     npx tsx drip-mine/scripts/chipnet.ts terminate  # XO action terminate on one Drip Mine coin of 740 sats or less
 *     npx tsx drip-mine/scripts/chipnet.ts rebroadcast <invitation>  # broadcast a signed drip or terminate again
 *
 * A node rejects a spend as "non-BIP68-final" until the coin is a block old by its own count, and the engine keeps
 * the coin reserved after a failed broadcast. `rebroadcast` sends the same stored transaction again without
 * re-signing (signing twice is refused as a conflicting commit).
 *
 * Uses the test wallet in templates/.xo-demo (gitignored). The Drip Mine address is the same one vox.cash/drip uses,
 * and on chipnet it already holds hundreds of coins funded by other people, which `drip` spends one at a time, as the
 * contract intends. The default 700-sat funding is small enough that `terminate` can then end it.
 *
 * Set DRIP_OUTPOINT=<txid>:<index> to choose the coin; otherwise the script picks the smallest suitable confirmed one.
 * A coin must be at least one block old (the contract's relative timelock), so wait a minute after `fund`.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, decodeTransactionBch, hexToBin, sha256 } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeInvitation, serializeTemplate } from '@xo-cash/utils';
import { createChipnetEngine, loadOrCreateMnemonic, signAndBroadcast } from '../../shared/chipnet-engine.js';
import { findOutputIndex } from '../../shared/chipnet-tokens.js';

const mode = process.argv[2];
const FOLDER = join(import.meta.dirname, '..', '..', '.xo-demo');
const STATE_FILE = join(FOLDER, 'drip-mine.json');
// The contract drips coins above dustLimit + minPayout and terminates the rest.
const TERMINATE_AT_OR_BELOW = 740n;

const TEMPLATE_JSON = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');
const TEMPLATE_ID = generateTemplateIdentifier(parseTemplate(TEMPLATE_JSON));

interface DripMineState {
    fundTransactionHash?: string;
    fundOutputIndex?: number;
    dripTransactionHashes?: string[];
    terminateTransactionHashes?: string[];
}

if (!['fund', 'drip', 'terminate', 'rebroadcast'].includes(mode ?? '') || (mode === 'rebroadcast' && !process.argv[3])) {
    console.error('Usage: chipnet.ts fund | drip | terminate | rebroadcast <invitation>');
    process.exit(1);
}

const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);
const readState = (): DripMineState => (existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as DripMineState) : {});
const writeState = (state: DripMineState): void => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const engine = await createChipnetEngine(loadOrCreateMnemonic(FOLDER), FOLDER);

try {
    step('Importing templates');

    const imported = await engine.importTemplate(TEMPLATE_JSON);

    if (imported.templateIdentifier !== TEMPLATE_ID) {
        throw new Error(`Identifier mismatch: engine ${imported.templateIdentifier}, template.json ${TEMPLATE_ID}`);
    }

    const { templateIdentifier: p2pkhIdentifier } = await engine.importTemplate(serializeTemplate(p2pkhTemplate));

    await engine.setDefaultPolicies({
        change: { templateIdentifier: p2pkhIdentifier },
        receive: { templateIdentifier: p2pkhIdentifier },
        address: { templateIdentifier: p2pkhIdentifier },
    });
    console.log(`  Drip Mine ${TEMPLATE_ID}`);

    const template = await engine.getTemplate(TEMPLATE_ID);

    if (!template) {
        throw new Error('Template missing after import.');
    }

    const state = readState();
    const dripLock = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'dripMineLockingScript', {});

    if (mode === 'rebroadcast') {
        const invitationIdentifier = process.argv[3] as string;
        const stored = await engine.getInvitation(invitationIdentifier);

        if (!stored) {
            throw new Error(`Invitation ${invitationIdentifier} is not in this wallet.`);
        }

        step(`Broadcasting the stored ${stored.invitation.actionIdentifier} transaction of ${invitationIdentifier} again`);

        const result = await engine.executeAction(invitationIdentifier, { broadcastTransaction: true });
        const file = join(FOLDER, `invitation-drip-mine-${stored.invitation.actionIdentifier}-${invitationIdentifier}.json`);

        writeFileSync(file, serializeInvitation(result.storedInvitation.invitation));

        const key = stored.invitation.actionIdentifier === 'drip' ? 'dripTransactionHashes' : 'terminateTransactionHashes';

        state[key] = [...(state[key] ?? []), result.builtTransaction.transactionHash];
        writeState(state);
        console.log(`\nBROADCAST ${result.builtTransaction.transactionHash}\n  invitation saved: ${file}`);
    } else if (mode === 'fund') {
        const satoshis = BigInt(process.env.FUND_SATS ?? '700');
        const feeCoin = (await engine.listSpendableUnspentOutputs())
            .filter((output) => output.tokenCategory === undefined)
            .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        if (!feeCoin || BigInt(feeCoin.valueSatoshis) < satoshis + 500n) {
            throw new Error('No plain BCH coin large enough for this funding. Fund the test wallet first.');
        }

        const intent = template.start?.find((entry) => entry.action === 'fund');

        if (!intent) {
            throw new Error('fund start intent not found.');
        }

        step(`Funding the Drip Mine with ${satoshis} sats (a gift to miners)`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fund',
            intent,
            variables: [{ variableIdentifier: 'fundSatoshis', roleIdentifier: 'funder', value: satoshis }],
            inputs: [{ outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex }],
        });

        // Tracked for the dripper role, so this wallet starts watching the Drip Mine address (and everyone's coins there).
        await engine.appendInvitation(created.invitation.invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fund',
            outputs: [{ outputIdentifier: 'fundingOutput', roleIdentifier: 'dripper' }],
        });

        const funded = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'drip-mine-fund' });

        state.fundTransactionHash = funded.transactionHash;
        state.fundOutputIndex = funded.serializedTransaction ? findOutputIndex(funded.serializedTransaction, dripLock) : undefined;
        writeState(state);
        console.log(`\nFUNDED ${funded.transactionHash}:${state.fundOutputIndex}. After one block:  npx tsx drip-mine/scripts/chipnet.ts terminate`);
    } else {
        const dripScriptHash = binToHex(sha256.hash(dripLock).reverse());
        const coins = (await engine.listUnspentOutputs()).filter((output) => output.scriptHash === dripScriptHash && output.reservedBy === undefined);
        const confirmed = coins.filter((coin) => coin.minedAtHeight !== undefined && coin.minedAtHeight > 0);

        step(`This wallet sees ${coins.length} Drip Mine coin(s), ${confirmed.length} with a known block height`);

        if (coins.length === 0) {
            throw new Error('No Drip Mine coins in view. (A wallet only watches the address after funding it once: run "fund".)');
        }

        const wanted = process.env.DRIP_OUTPOINT;
        const suitable = (value: bigint): boolean => (mode === 'drip' ? value > TERMINATE_AT_OR_BELOW : value <= TERMINATE_AT_OR_BELOW);
        // Without a block height the engine can't tell a coin is old enough, so prefer confirmed coins, then any.
        const pool = confirmed.some((coin) => suitable(BigInt(coin.valueSatoshis))) ? confirmed : coins;
        const coin = wanted
            ? coins.find((candidate) => `${candidate.outpointTransactionHash}:${candidate.outpointIndex}` === wanted)
            : pool.filter((candidate) => suitable(BigInt(candidate.valueSatoshis))).sort((a, b) => Number(BigInt(a.valueSatoshis) - BigInt(b.valueSatoshis)))[0];

        if (!coin) {
            throw new Error(wanted ? `${wanted} is not a Drip Mine coin this wallet sees.` : `No Drip Mine coin suitable for "${mode}".`);
        }

        const coinValue = BigInt(coin.valueSatoshis);
        const intent = template.start?.find((entry) => entry.action === mode);

        if (!intent) {
            throw new Error(`${mode} start intent not found.`);
        }

        step(`${mode === 'drip' ? 'Dripping' : 'Terminating'} ${coin.outpointTransactionHash}:${coin.outpointIndex} (${coinValue} sats, height ${coin.minedAtHeight ?? 'unknown'})`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: mode as string,
            intent,
            variables: [{ variableIdentifier: 'dripCoinSatoshis', roleIdentifier: 'dripper', value: coinValue }],
            inputs: [{ inputIdentifier: 'dripMineInput', outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex }],
        });
        const { invitationIdentifier } = created.invitation;

        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: mode as string,
            outputs: [{ outputIdentifier: mode === 'drip' ? 'dripRemainderOutput' : 'terminalOutput', ...(mode === 'drip' ? { roleIdentifier: 'dripper' } : {}) }],
        });

        step('Sign and broadcast with no change: one input, one output, and the difference is the miner fee');

        const spent = await signAndBroadcast(engine, invitationIdentifier, { folder: FOLDER, label: `drip-mine-${mode}`, addChange: false });

        if (spent.serializedTransaction) {
            const decoded = decodeTransactionBch(hexToBin(spent.serializedTransaction));

            if (typeof decoded === 'string') {
                throw new Error(decoded);
            }

            const [output] = decoded.outputs;
            const fee = coinValue - (output?.valueSatoshis ?? 0n);

            console.log(
                `  ${spent.serializedTransaction.length / 2} bytes, inputs ${decoded.inputs.length} (sequence ${decoded.inputs[0]?.sequenceNumber}), outputs ${decoded.outputs.length}: ${output ? `${output.valueSatoshis} sats to ${binToHex(output.lockingBytecode)}` : '-'}; fee to the miner ${fee} sats`,
            );
        }

        const key = mode === 'drip' ? 'dripTransactionHashes' : 'terminateTransactionHashes';

        state[key] = [...(state[key] ?? []), spent.transactionHash];
        writeState(state);
        console.log(`\n${mode === 'drip' ? 'DRIPPED' : 'TERMINATED'}: ${spent.transactionHash}`);
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
