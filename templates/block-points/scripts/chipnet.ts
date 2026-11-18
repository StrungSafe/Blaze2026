/**
 * Block Points on CHIPNET (test coins and test tokens only), through the XO engine.
 *
 *     npx tsx block-points/scripts/chipnet.ts fund-thread   # XO action fundThread: test tokens into a new vault thread
 *     npx tsx block-points/scripts/chipnet.ts claim         # XO action claim: tokens for the age of one of our coins
 *     npx tsx block-points/scripts/chipnet.ts rebroadcast <invitation>   # resend a stored, signed claim
 *     npx tsx block-points/scripts/chipnet.ts release <invitation>       # archive an abandoned invitation, freeing its coins
 *
 * Uses the test wallet in templates/.xo-demo (gitignored). The vault address is the one vox.cash/bpt uses, and on
 * chipnet it already holds the tBPTS threads, which `claim` claims from as the contract intends.
 *
 * `fund-thread` deposits THREAD_TOKENS (default 100,000) of TOKEN_CATEGORY (default: the test token token-burner's
 * `mint` created) with 800 sats. It also makes this wallet watch the vault address, which `claim` needs.
 *
 * `claim` uses this wallet's largest confirmed plain BCH coin and the oldest thread of CLAIM_CATEGORY (default tBPTS),
 * or THREAD_OUTPOINT=<txid>:<index>. The reward is age × coin value / 100,000,000 tokens, so a claim needs a coin of
 * roughly 0.1 tBCH or more to earn anything within a few blocks.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, decodeTransactionBch, hexToBin, sha256 } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeInvitation, serializeTemplate } from '@xo-cash/utils';
import { createChipnetEngine, loadOrCreateMnemonic, signAndBroadcast } from '../../shared/chipnet-engine.js';
import { findOutputIndex, getChipnetTipHeight } from '../../shared/chipnet-tokens.js';

const mode = process.argv[2];
const FOLDER = join(import.meta.dirname, '..', '..', '.xo-demo');
const STATE_FILE = join(FOLDER, 'block-points.json');
const TBPTS = '10608586e070bbea7142435775f79161751972f180f64752bae974dbe023ebc3';
const SATOSHIS_PER_COIN = 100_000_000n;
const MAXIMUM_AGE = 65_535;

const TEMPLATE_JSON = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');
const TEMPLATE_ID = generateTemplateIdentifier(parseTemplate(TEMPLATE_JSON));

interface BlockPointsState {
    fundThreadTransactionHash?: string;
    fundThreadOutputIndex?: number;
    claimTransactionHashes?: string[];
}

if (!['fund-thread', 'claim', 'rebroadcast', 'release'].includes(mode ?? '') || (['rebroadcast', 'release'].includes(mode ?? '') && !process.argv[3])) {
    console.error('Usage: chipnet.ts fund-thread | claim | rebroadcast <invitation> | release <invitation>');
    process.exit(1);
}

const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);
const readState = (): BlockPointsState => (existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as BlockPointsState) : {});
const writeState = (state: BlockPointsState): void => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

/** The test token token-burner/scripts/chipnet.ts minted, unless TOKEN_CATEGORY names another. */
function testTokenCategory(): string {
    const fromEnvironment = process.env.TOKEN_CATEGORY;
    const tokenBurnerState = join(FOLDER, 'token-burner.json');

    if (fromEnvironment) {
        return fromEnvironment;
    }

    if (existsSync(tokenBurnerState)) {
        const category = (JSON.parse(readFileSync(tokenBurnerState, 'utf8')) as { tokenCategory?: string }).tokenCategory;

        if (category) {
            return category;
        }
    }

    throw new Error('No test token: run "npx tsx token-burner/scripts/chipnet.ts mint" first, or set TOKEN_CATEGORY.');
}

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
    console.log(`  Block Points ${TEMPLATE_ID}`);

    const template = await engine.getTemplate(TEMPLATE_ID);

    if (!template) {
        throw new Error('Template missing after import.');
    }

    const state = readState();
    const vaultLock = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'vaultLockingScript', {});

    if (mode === 'release') {
        // An invitation abandoned mid-way (for example after a lost Electrum connection) keeps its coins reserved;
        // archiving it clears those reservations.
        await engine.archiveInvitation(process.argv[3] as string);
        console.log(`
RELEASED the coins reserved by ${process.argv[3]}`);
    } else if (mode === 'rebroadcast') {
        // After a failed broadcast (often "non-BIP68-final" from a node a block behind), the engine keeps the coins
        // reserved; signing again is refused, but executeAction sends the stored transaction again.
        const invitationIdentifier = process.argv[3] as string;

        step(`Broadcasting the stored transaction of ${invitationIdentifier} again`);

        const result = await engine.executeAction(invitationIdentifier, { broadcastTransaction: true });
        const file = join(FOLDER, `invitation-block-points-claim-${invitationIdentifier}.json`);

        writeFileSync(file, serializeInvitation(result.storedInvitation.invitation));
        state.claimTransactionHashes = [...(state.claimTransactionHashes ?? []), result.builtTransaction.transactionHash];
        writeState(state);
        console.log(`\nBROADCAST ${result.builtTransaction.transactionHash}\n  invitation saved: ${file}`);
    } else if (mode === 'fund-thread') {
        const tokenCategory = testTokenCategory();
        const threadTokens = BigInt(process.env.THREAD_TOKENS ?? '100000');
        const tokenCoin = (await engine.listUnspentOutputs()).find((output) => output.tokenCategory === tokenCategory && output.scriptHash !== binToHex(sha256.hash(vaultLock).reverse()) && BigInt(output.tokenAmount ?? '0') >= threadTokens);
        const feeCoin = (await engine.listSpendableUnspentOutputs())
            .filter((output) => output.tokenCategory === undefined)
            .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        if (!tokenCoin) {
            throw new Error(`This wallet holds no coin with ${threadTokens} tokens of ${tokenCategory}.`);
        }

        if (!feeCoin) {
            throw new Error('No plain BCH coin left to pay for the thread and the fee.');
        }

        const intent = template.start?.find((entry) => entry.action === 'fundThread');

        if (!intent) {
            throw new Error('fundThread start intent not found.');
        }

        step(`Funding a vault thread with ${threadTokens} of ${tokenCoin.tokenAmount} tokens of ${tokenCategory.slice(0, 12)}…`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fundThread',
            intent,
            variables: [
                { variableIdentifier: 'tokenCategory', roleIdentifier: 'funder', value: tokenCategory },
                { variableIdentifier: 'threadTokenAmount', roleIdentifier: 'funder', value: threadTokens },
                { variableIdentifier: 'threadSatoshis', roleIdentifier: 'funder', value: 800n },
            ],
            inputs: [
                { outpointTransactionHash: hexToBin(tokenCoin.outpointTransactionHash), outpointIndex: tokenCoin.outpointIndex },
                { outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex },
            ],
        });

        // Tracked for the claimant role, so this wallet starts watching the vault address (and every thread there).
        await engine.appendInvitation(created.invitation.invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'fundThread',
            outputs: [{ outputIdentifier: 'vaultThreadOutput', roleIdentifier: 'claimant' }],
        });

        const funded = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'block-points-fund-thread' });

        state.fundThreadTransactionHash = funded.transactionHash;
        state.fundThreadOutputIndex = funded.serializedTransaction ? findOutputIndex(funded.serializedTransaction, vaultLock) : undefined;
        writeState(state);
        console.log(`\nTHREAD FUNDED ${funded.transactionHash}:${state.fundThreadOutputIndex}`);
    } else {
        const tip = await getChipnetTipHeight();
        const vaultScriptHash = binToHex(sha256.hash(vaultLock).reverse());
        const claimCategory = process.env.CLAIM_CATEGORY ?? TBPTS;
        const wantedThread = process.env.THREAD_OUTPOINT;
        const threads = (await engine.listUnspentOutputs()).filter(
            (output) => output.scriptHash === vaultScriptHash && output.reservedBy === undefined && output.tokenCategory !== undefined && output.minedAtHeight !== undefined && output.minedAtHeight > 0,
        );
        const thread = wantedThread
            ? threads.find((candidate) => `${candidate.outpointTransactionHash}:${candidate.outpointIndex}` === wantedThread)
            : threads.filter((candidate) => candidate.tokenCategory === claimCategory).sort((a, b) => (a.minedAtHeight ?? 0) - (b.minedAtHeight ?? 0))[0];
        const coin = (await engine.listSpendableUnspentOutputs())
            .filter((output) => output.tokenCategory === undefined && output.minedAtHeight !== undefined && output.minedAtHeight > 0)
            .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        step(`Tip ${tip}; this wallet sees ${threads.length} confirmed vault thread(s)`);

        if (!thread) {
            throw new Error(threads.length === 0 ? 'No vault threads in view. (A wallet only watches the vault after funding a thread: run "fund-thread".)' : `No thread of ${claimCategory} in view.`);
        }

        if (!coin) {
            throw new Error('No confirmed plain BCH coin to claim with.');
        }

        // The next block is tip + 1, so an age of tip - (the younger coin's height) is already satisfied there.
        const age = BigInt(Math.min(MAXIMUM_AGE, tip - Math.max(coin.minedAtHeight as number, thread.minedAtHeight as number)));
        const coinValue = BigInt(coin.valueSatoshis);
        const reward = (age * coinValue) / SATOSHIS_PER_COIN;

        console.log(`  coin   ${coin.outpointTransactionHash}:${coin.outpointIndex} ${coinValue} sats, height ${coin.minedAtHeight}`);
        console.log(`  thread ${thread.outpointTransactionHash}:${thread.outpointIndex} ${thread.tokenAmount} tokens of ${thread.tokenCategory?.slice(0, 12)}…, height ${thread.minedAtHeight}`);
        console.log(`  age ${age} blocks → reward ${reward} tokens`);

        if (age < 1n || reward < 1n) {
            throw new Error(`A claim would earn ${reward} tokens (age ${age} × ${coinValue} sats / 100,000,000). Use a larger or older coin.`);
        }

        const intent = template.start?.find((entry) => entry.action === 'claim');

        if (!intent) {
            throw new Error('claim start intent not found.');
        }

        const rewardLockingScript = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'claim',
            intent,
            variables: [
                { variableIdentifier: 'tokenCategory', roleIdentifier: 'claimant', value: thread.tokenCategory as string },
                { variableIdentifier: 'vaultTokenAmount', roleIdentifier: 'claimant', value: BigInt(thread.tokenAmount ?? '0') },
                { variableIdentifier: 'vaultSatoshis', roleIdentifier: 'claimant', value: BigInt(thread.valueSatoshis) },
                { variableIdentifier: 'claimantCoinSatoshis', roleIdentifier: 'claimant', value: coinValue },
                { variableIdentifier: 'age', roleIdentifier: 'claimant', value: age },
                { variableIdentifier: 'rewardLockingScript', roleIdentifier: 'claimant', value: rewardLockingScript },
            ],
            inputs: [
                { inputIdentifier: 'claimantCoinInput', outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex },
                { inputIdentifier: 'vaultInput', outpointTransactionHash: hexToBin(thread.outpointTransactionHash), outpointIndex: thread.outpointIndex },
            ],
        });
        const { invitationIdentifier } = created.invitation;

        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'claim',
            outputs: [{ outputIdentifier: 'rewardOutput' }, { outputIdentifier: 'vaultReturnOutput', roleIdentifier: 'claimant' }],
        });

        step('Change, sign, broadcast');

        const claimed = await signAndBroadcast(engine, invitationIdentifier, { folder: FOLDER, label: 'block-points-claim' });

        if (claimed.serializedTransaction) {
            const decoded = decodeTransactionBch(hexToBin(claimed.serializedTransaction));

            if (typeof decoded === 'string') {
                throw new Error(decoded);
            }

            decoded.inputs.forEach((input, index) => console.log(`  in ${index}: ${binToHex(input.outpointTransactionHash).slice(0, 12)}…:${input.outpointIndex} sequence ${input.sequenceNumber}`));
            decoded.outputs.forEach((output, index) =>
                console.log(`  out ${index}: ${output.valueSatoshis} sats to ${binToHex(output.lockingBytecode).slice(0, 16)}…${output.token ? `, ${output.token.amount} tokens of ${binToHex(output.token.category).slice(0, 12)}…` : ''}`),
            );
        }

        state.claimTransactionHashes = [...(state.claimTransactionHashes ?? []), claimed.transactionHash];
        writeState(state);
        console.log(`\nCLAIMED: ${claimed.transactionHash}`);
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
