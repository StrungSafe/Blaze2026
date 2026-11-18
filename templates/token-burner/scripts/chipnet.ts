/**
 * Token Burner on CHIPNET (test coins and test tokens only), through the XO engine.
 *
 *     npx tsx token-burner/scripts/chipnet.ts mint      # creates a test fungible token in the XO wallet
 *     npx tsx token-burner/scripts/chipnet.ts deposit   # XO action depositFungibleTokens: sends some to the burner
 *     npx tsx token-burner/scripts/chipnet.ts burn      # XO action burn: destroys them with a farewell message
 *     npx tsx token-burner/scripts/chipnet.ts deposit-bch  # XO action depositSatoshis: BCH to the burner (a gift to miners)
 *     npx tsx token-burner/scripts/chipnet.ts burn-all  # XO action burn on every coin at the burner address, anyone's
 *
 * Uses the test wallet in templates/.xo-demo (gitignored), which needs a few thousand chipnet satoshis. The burner
 * address is the same one tokenburner.cash uses on chipnet, so the burn also appears in its chipnet feed.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, decodeTransactionBch, hexToBin, sha256 } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier, getTemplateLockingScriptOrThrow } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';

type XOTemplate = ReturnType<typeof parseTemplate>;
import { createChipnetEngine, loadOrCreateMnemonic, signAndBroadcast } from '../../shared/chipnet-engine.js';
import { broadcastToChipnet, buildFungibleGenesis, findOutputIndex, loadOrCreateMinterKey } from '../../shared/chipnet-tokens.js';

const mode = process.argv[2];
const FOLDER = join(import.meta.dirname, '..', '..', '.xo-demo');
const STATE_FILE = join(FOLDER, 'token-burner.json');
const MINT_AMOUNT = 1_000_000n;
const BURN_AMOUNT = 250_000n;
const MINT_FUNDING_SATS = 3_000n;
const TOKEN_SATS = 1_000n;
const BURN_MESSAGE = process.env.BURN_MESSAGE ?? 'XOGrid test burn via the Token Burner XO template';

const TEMPLATE_JSON = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');
const TEMPLATE_ID = generateTemplateIdentifier(parseTemplate(TEMPLATE_JSON));

interface BurnerState {
    mintFundingTransactionHash?: string;
    mintFundingOutputIndex?: number;
    genesisTransactionHash?: string;
    tokenCategory?: string;
    depositTransactionHash?: string;
    depositOutputIndex?: number;
    burnTransactionHash?: string;
    burnAllTransactionHashes?: string[];
    depositBchTransactionHash?: string;
}

if (!['mint', 'deposit', 'burn', 'deposit-bch', 'burn-all'].includes(mode ?? '')) {
    console.error('Usage: chipnet.ts mint | deposit | burn | deposit-bch | burn-all');
    process.exit(1);
}

const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);
const readState = (): BurnerState => (existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as BurnerState) : {});
const writeState = (state: BurnerState): void => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));

const engine = await createChipnetEngine(loadOrCreateMnemonic(FOLDER), FOLDER);

/** Waits up to `seconds` for `found` to return a value, polling the engine's view of the wallet. */
async function waitFor<T>(label: string, found: () => Promise<T | undefined>, seconds = 120): Promise<T> {
    const deadline = Date.now() + seconds * 1000;

    while (Date.now() < deadline) {
        const value = await found();

        if (value !== undefined) {
            return value;
        }

        await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    throw new Error(`Timed out waiting for ${label}.`);
}

/** Pays MINT_FUNDING_SATS from the XO wallet to the minter key (p2pkh template) and records where the coin landed. */
async function payMinter(minterLock: Uint8Array, p2pkhIdentifier: string, p2pkh: XOTemplate, state: BurnerState): Promise<void> {
    const funding = (await engine.listSpendableUnspentOutputs())
        .filter((output) => output.tokenCategory === undefined)
        .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

    if (!funding || BigInt(funding.valueSatoshis) < MINT_FUNDING_SATS + 1000n) {
        throw new Error('The test wallet needs a few thousand chipnet satoshis. Fund it (see revenue-split/scripts/chipnet.ts) and retry.');
    }

    step(`Paying ${MINT_FUNDING_SATS} sats to the minter key (p2pkh template, sendSatoshis)`);

    const sendIntent = getTemplateLockingScriptOrThrow(p2pkh, 'receivingLockingScript').roles?.receiver?.actions?.find((intent) => intent.action === 'sendSatoshis');

    if (!sendIntent) {
        throw new Error('sendSatoshis intent not found in the p2pkh template.');
    }

    const send = await engine.createInvitation({
        templateIdentifier: p2pkhIdentifier,
        actionIdentifier: 'sendSatoshis',
        intent: sendIntent,
        variables: [
            { variableIdentifier: 'transferredSatoshis', roleIdentifier: 'sender', value: MINT_FUNDING_SATS },
            { variableIdentifier: 'recipientLockingscript', roleIdentifier: 'sender', value: binToHex(minterLock) },
        ],
        inputs: [{ outpointTransactionHash: hexToBin(funding.outpointTransactionHash), outpointIndex: funding.outpointIndex }],
    });

    await engine.appendInvitation(send.invitation.invitationIdentifier, {
        templateIdentifier: p2pkhIdentifier,
        actionIdentifier: 'sendSatoshis',
        outputs: [{ outputIdentifier: 'transferSatoshisOutput' }],
    });

    const funded = await signAndBroadcast(engine, send.invitation.invitationIdentifier, { folder: FOLDER, label: 'token-burner-mint-funding' });

    if (!funded.serializedTransaction) {
        throw new Error('The engine did not return the funding transaction, so the minter output index is unknown.');
    }

    state.mintFundingTransactionHash = funded.transactionHash;
    state.mintFundingOutputIndex = findOutputIndex(funded.serializedTransaction, minterLock);
    writeState(state);
}

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
    console.log(`  Token Burner ${TEMPLATE_ID}`);

    const template = await engine.getTemplate(TEMPLATE_ID);
    const p2pkh = await engine.getTemplate(p2pkhIdentifier);

    if (!template || !p2pkh) {
        throw new Error('Templates missing after import.');
    }

    const state = readState();

    if (mode === 'mint') {
        if (state.genesisTransactionHash) {
            throw new Error(`Already minted ${state.tokenCategory} in ${state.genesisTransactionHash}. Run "deposit" next.`);
        }

        const minter = loadOrCreateMinterKey(FOLDER);

        // A funding transaction already broadcast by an earlier run is reused, so the minter is never paid twice.
        if (state.mintFundingTransactionHash === undefined || state.mintFundingOutputIndex === undefined) {
            await payMinter(minter.lockingBytecode, p2pkhIdentifier, p2pkh, state);
        } else {
            console.log(`\nReusing the minter funding ${state.mintFundingTransactionHash}:${state.mintFundingOutputIndex}`);
        }

        const fundingHash = state.mintFundingTransactionHash as string;
        const outputIndex = state.mintFundingOutputIndex as number;

        step(`Token genesis from ${fundingHash}:${outputIndex}`);

        const recipient = hexToBin(await engine.generateLockingBytecodeFromDefaultPolicy('receive'));
        const genesis = buildFungibleGenesis({
            minter,
            coin: { transactionHash: fundingHash, outputIndex, valueSatoshis: MINT_FUNDING_SATS },
            tokenAmount: MINT_AMOUNT,
            tokenSatoshis: TOKEN_SATS,
            tokenRecipient: recipient,
            changeRecipient: recipient,
        });
        const broadcastHash = await broadcastToChipnet(genesis.serializedTransaction);

        state.genesisTransactionHash = broadcastHash;
        state.tokenCategory = genesis.category;
        writeState(state);
        console.log(`  BROADCAST ${broadcastHash}\n  token category ${genesis.category} (${MINT_AMOUNT} units)`);
        console.log('\nMINTED. Next:  npx tsx token-burner/scripts/chipnet.ts deposit');
    } else if (mode === 'deposit') {
        if (!state.tokenCategory) {
            throw new Error('No test token yet: run "mint" first.');
        }

        step('Waiting for the engine to see the minted tokens');

        const tokenCoin = await waitFor('the minted token coin', async () =>
            (await engine.listUnspentOutputs()).find((output) => output.tokenCategory === state.tokenCategory && BigInt(output.tokenAmount ?? '0') >= BURN_AMOUNT),
        );
        const feeCoin = (await engine.listSpendableUnspentOutputs())
            .filter((output) => output.tokenCategory === undefined)
            .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        if (!feeCoin) {
            throw new Error('No plain BCH coin left to pay the deposit fee.');
        }

        const intent = template.start?.find((entry) => entry.action === 'depositFungibleTokens');

        if (!intent) {
            throw new Error('depositFungibleTokens start intent not found.');
        }

        step(`Creating depositFungibleTokens for ${BURN_AMOUNT} of ${tokenCoin.tokenAmount} tokens`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'depositFungibleTokens',
            intent,
            variables: [
                { variableIdentifier: 'tokenCategory', roleIdentifier: 'depositor', value: state.tokenCategory },
                { variableIdentifier: 'tokenAmount', roleIdentifier: 'depositor', value: BURN_AMOUNT },
                { variableIdentifier: 'depositSatoshis', roleIdentifier: 'depositor', value: TOKEN_SATS },
            ],
            inputs: [
                { outpointTransactionHash: hexToBin(tokenCoin.outpointTransactionHash), outpointIndex: tokenCoin.outpointIndex },
                { outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex },
            ],
        });
        const { invitationIdentifier } = created.invitation;

        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'depositFungibleTokens',
            outputs: [{ outputIdentifier: 'burnerFungibleOutput', roleIdentifier: 'burner' }],
        });

        step('Change (BCH and the remaining tokens), sign, broadcast');

        const deposited = await signAndBroadcast(engine, invitationIdentifier, { folder: FOLDER, label: 'token-burner-deposit' });
        const burnerLock = (await engine.resolveInvitationOutputLockingBytecode(invitationIdentifier, 'burnerFungibleOutput', 'burner')).toLowerCase();

        state.depositTransactionHash = deposited.transactionHash;
        state.depositOutputIndex = deposited.serializedTransaction ? findOutputIndex(deposited.serializedTransaction, hexToBin(burnerLock)) : 0;
        writeState(state);
        console.log(`\nDEPOSITED at ${deposited.transactionHash}:${state.depositOutputIndex}. Next:  npx tsx token-burner/scripts/chipnet.ts burn`);
    } else if (mode === 'deposit-bch') {
        const satoshis = BigInt(process.env.DEPOSIT_SATS ?? '1000');
        const feeCoin = (await engine.listSpendableUnspentOutputs())
            .filter((output) => output.tokenCategory === undefined)
            .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

        if (!feeCoin || BigInt(feeCoin.valueSatoshis) < satoshis + 500n) {
            throw new Error('No plain BCH coin large enough for this deposit.');
        }

        const intent = template.start?.find((entry) => entry.action === 'depositSatoshis');

        if (!intent) {
            throw new Error('depositSatoshis start intent not found.');
        }

        step(`Sending ${satoshis} sats to the burner (depositSatoshis: a gift to the miner of the next burn)`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'depositSatoshis',
            intent,
            variables: [{ variableIdentifier: 'depositSatoshis', roleIdentifier: 'depositor', value: satoshis }],
            inputs: [{ outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex }],
        });

        await engine.appendInvitation(created.invitation.invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'depositSatoshis',
            outputs: [{ outputIdentifier: 'burnerSatoshisOutput', roleIdentifier: 'burner' }],
        });

        const deposited = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'token-burner-deposit-bch' });

        state.depositBchTransactionHash = deposited.transactionHash;
        writeState(state);
        console.log(`\nBCH DEPOSITED: ${deposited.transactionHash}. Sweep it with:  npx tsx token-burner/scripts/chipnet.ts burn-all`);
    } else if (mode === 'burn-all') {
        // Every deposit shares one burner script, so once this wallet watches it the engine tracks everyone's coins.
        const burnerLock = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'burnerLockingScript', {});
        const burnerScriptHash = binToHex(sha256.hash(burnerLock).reverse());
        const coins = (await engine.listUnspentOutputs()).filter((output) => output.scriptHash === burnerScriptHash && output.reservedBy === undefined);

        if (coins.length === 0) {
            throw new Error('This wallet sees no coins at the burner address. (A wallet only watches it after using the burner once.)');
        }

        step(`Found ${coins.length} coin(s) at the burner address`);
        coins.forEach((coin) =>
            console.log(`  ${coin.outpointTransactionHash}:${coin.outpointIndex} ${coin.valueSatoshis} sats, ${coin.tokenCategory ? `${coin.tokenAmount ?? 0} of ${coin.tokenCategory.slice(0, 12)}…` : 'no tokens'}`),
        );

        // Uses the template's burn start entry, so any wallet that watches the burner address can sweep it.
        const intent = template.start?.find((entry) => entry.action === 'burn');

        if (!intent) {
            throw new Error('burn intent not found on the burner locking script.');
        }

        /** Burns `batch` in one transaction through the template's burn action, and checks its shape. */
        const burnCoins = async (batch: typeof coins, label: string): Promise<string> => {
            const created = await engine.createInvitation({
                templateIdentifier: TEMPLATE_ID,
                actionIdentifier: 'burn',
                intent,
                variables: [{ variableIdentifier: 'burnMessage', roleIdentifier: 'burner', value: BURN_MESSAGE }],
                inputs: batch.map((coin) => ({
                    inputIdentifier: 'burnerInput',
                    outpointTransactionHash: hexToBin(coin.outpointTransactionHash),
                    outpointIndex: coin.outpointIndex,
                })),
            });

            await engine.appendInvitation(created.invitation.invitationIdentifier, {
                templateIdentifier: TEMPLATE_ID,
                actionIdentifier: 'burn',
                outputs: [{ outputIdentifier: 'farewellOutput' }],
            });

            const burned = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label, addChange: false });
            const decoded = burned.serializedTransaction ? decodeTransactionBch(hexToBin(burned.serializedTransaction)) : undefined;

            if (typeof decoded === 'object') {
                console.log(`  inputs: ${decoded.inputs.length}, outputs: ${decoded.outputs.length}, output 0 starts with ${binToHex(decoded.outputs[0]?.lockingBytecode.slice(0, 1) ?? new Uint8Array())}, token: ${decoded.outputs[0]?.token ? 'yes' : 'none'}`);
            }

            return burned.transactionHash;
        };

        state.burnAllTransactionHashes = [];

        try {
            step(`Burning all ${coins.length} coin(s) in one transaction`);
            state.burnAllTransactionHashes.push(await burnCoins(coins, 'token-burner-burn-all'));
        } catch (error) {
            console.log(`  The engine refused a batch burn (${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}).`);
            step('Falling back to one burn per coin');

            for (const [index, coin] of coins.entries()) {
                state.burnAllTransactionHashes.push(await burnCoins([coin], `token-burner-burn-all-${index}`));
            }
        }

        writeState(state);
        console.log(`\nBURNED ALL: ${state.burnAllTransactionHashes.join(', ')}`);
    } else {
        if (state.depositTransactionHash === undefined || state.depositOutputIndex === undefined) {
            throw new Error('Nothing deposited yet: run "deposit" first.');
        }

        if (state.burnTransactionHash) {
            throw new Error(`Already burned in ${state.burnTransactionHash}. Run "deposit" again for a new burn.`);
        }

        const intent = getTemplateLockingScriptOrThrow(template, 'burnerLockingScript').roles?.burner?.actions?.find((entry) => entry.action === 'burn');

        if (!intent) {
            throw new Error('burn intent not found on the burner locking script.');
        }

        step(`Creating the burn for ${state.depositTransactionHash}:${state.depositOutputIndex}`);

        const created = await engine.createInvitation({
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'burn',
            intent,
            variables: [{ variableIdentifier: 'burnMessage', roleIdentifier: 'burner', value: BURN_MESSAGE }],
            inputs: [
                { inputIdentifier: 'burnerInput', outpointTransactionHash: hexToBin(state.depositTransactionHash), outpointIndex: state.depositOutputIndex },
            ],
        });
        const { invitationIdentifier } = created.invitation;

        await engine.appendInvitation(invitationIdentifier, {
            templateIdentifier: TEMPLATE_ID,
            actionIdentifier: 'burn',
            outputs: [{ outputIdentifier: 'farewellOutput' }],
        });

        step('Sign and broadcast, with no change: the farewell OP_RETURN must be the only output');

        const burned = await signAndBroadcast(engine, invitationIdentifier, { folder: FOLDER, label: 'token-burner-burn', addChange: false });

        if (burned.serializedTransaction) {
            const decoded = decodeTransactionBch(hexToBin(burned.serializedTransaction));

            if (typeof decoded === 'string') {
                throw new Error(decoded);
            }

            const [only] = decoded.outputs;

            console.log(`  outputs: ${decoded.outputs.length}, output 0 starts with ${only ? binToHex(only.lockingBytecode.slice(0, 1)) : '-'}, token: ${only?.token ? 'yes' : 'none'}`);
        }

        state.burnTransactionHash = burned.transactionHash;
        writeState(state);
        console.log(`\nBURNED: ${burned.transactionHash}`);
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
