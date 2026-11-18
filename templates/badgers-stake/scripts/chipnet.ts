/**
 * Badgers Stake on CHIPNET (test coins and test tokens only), through the XO engine.
 *
 * The real contract hard-codes the badgers.cash masterBadger category, which exists only on mainnet. So this script
 * runs a CHIPNET TEST VARIANT: the same contract and template with our own test category swapped into both the
 * bytecode and the `badgerCategory` constant (variantTemplateJson below). It has its own address and identifier.
 *
 *     npx tsx badgers-stake/scripts/chipnet.ts mint       # a test masterBadger (minting NFT + supply) to our admin address
 *     npx tsx badgers-stake/scripts/chipnet.ts deploy     # XO action deploy: the masterBadger into the variant contract
 *     npx tsx badgers-stake/scripts/chipnet.ts withdraw   # XO action withdraw: the admin collects fees, sets a new fee
 *     npx tsx badgers-stake/scripts/chipnet.ts stake      # XO action stake (needs a single coin of ~7,300+ sats)
 *     npx tsx badgers-stake/scripts/chipnet.ts unstake    # XO action unstake, once the lock period has passed
 *     npx tsx badgers-stake/scripts/chipnet.ts release <invitation>   # free the coins of an abandoned invitation
 *
 * Uses the test wallet in templates/.xo-demo (gitignored). STAKE_SATS (default 5000) and STAKE_BLOCKS (default: the
 * fewest blocks that earn one BadgerCoin) set the stake.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, hexToBin, sha256 } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier, getTemplateLockingScriptOrThrow, type Engine } from '@xo-cash/engine';
import { p2pkhTemplate } from '@xo-cash/templates';
import { fromExtendedJson, generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { createChipnetEngine, loadOrCreateMnemonic, signAndBroadcast } from '../../shared/chipnet-engine.js';
import { broadcastToChipnet, buildFungibleGenesis, findOutputIndex, getChipnetTipHeight, loadOrCreateMinterKey } from '../../shared/chipnet-tokens.js';

const mode = process.argv[2];
const FOLDER = join(import.meta.dirname, '..', '..', '.xo-demo');
const STATE_FILE = join(FOLDER, 'badgers-stake.json');
const MAINNET_CATEGORY_BYTES = 'd7ff0a63d5c1cbe1ced509314fe3caca563a73095be37734744c40dbce6e2f24';
const SUPPLY = 21_000_000_000_000n;
const MINT_FUNDING_SATS = 3500n;
const MASTER_SATS = 1000n;
const SATOSHIS_PER_COIN = 100_000_000n;

interface BadgersState {
    adminLockingBytecode?: string;
    mintFundingTransactionHash?: string;
    mintFundingOutputIndex?: number;
    genesisTransactionHash?: string;
    testCategory?: string;
    deployTransactionHash?: string;
    withdrawTransactionHashes?: string[];
    stakeTransactionHash?: string;
    stakeBlocks?: number;
    unstakeTransactionHash?: string;
}

const MODES = ['mint', 'deploy', 'withdraw', 'stake', 'unstake', 'release'];

if (!MODES.includes(mode ?? '') || (mode === 'release' && !process.argv[3])) {
    console.error(`Usage: chipnet.ts ${MODES.join(' | ')} [<invitation>]`);
    process.exit(1);
}

const step = (text: string): void => console.log(`\n[${new Date().toISOString().slice(11, 19)}] ${text}`);
const readState = (): BadgersState => (existsSync(STATE_FILE) ? (JSON.parse(readFileSync(STATE_FILE, 'utf8')) as BadgersState) : {});
const writeState = (state: BadgersState): void => writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
const reversedHex = (hex: string): string => binToHex(hexToBin(hex).reverse());
const scriptHashOf = (lockingBytecode: Uint8Array): string => binToHex(sha256.hash(lockingBytecode).reverse());

/** The template with the test category in place of the mainnet one: same contract, its own address and identifier. */
function variantTemplateJson(testCategory: string): string {
    const template = fromExtendedJson(readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8')) as {
        name: string;
        description: string;
        scripts: Record<string, string>;
        constants: Record<string, { value: unknown }>;
    };
    const bytecode = template.scripts.badgerBytecode as string;

    if (!bytecode.includes(`<0x${MAINNET_CATEGORY_BYTES}>`)) {
        throw new Error('The mainnet category was not found in badgerBytecode.');
    }

    template.name = `${template.name} (chipnet test)`;
    template.description = `CHIPNET TEST VARIANT with masterBadger category ${testCategory}. ${template.description}`;
    template.scripts.badgerBytecode = bytecode.replaceAll(`<0x${MAINNET_CATEGORY_BYTES}>`, `<0x${reversedHex(testCategory)}>`);
    (template.constants.badgerCategory as { value: unknown }).value = testCategory;

    return serializeTemplate(parseTemplate(template as Parameters<typeof parseTemplate>[0]));
}

/** Waits up to `seconds` for `found` to return a value, polling the engine's view of the wallet. */
async function waitFor<T>(label: string, found: () => Promise<T | undefined>, seconds = 180): Promise<T> {
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

/** Pays `satoshis` from the wallet to `lockingBytecode` with the p2pkh template, and returns where the coin landed. */
async function payTo(engine: Engine, p2pkhIdentifier: string, lockingBytecode: Uint8Array, satoshis: bigint): Promise<{ transactionHash: string; outputIndex: number }> {
    const p2pkh = await engine.getTemplate(p2pkhIdentifier);
    const intent = p2pkh && getTemplateLockingScriptOrThrow(p2pkh, 'receivingLockingScript').roles?.receiver?.actions?.find((entry) => entry.action === 'sendSatoshis');
    const plainCoins = (await engine.listSpendableUnspentOutputs()).filter((output) => output.tokenCategory === undefined).sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)));
    // Largest coins first, until they cover the payment and a fee.
    const coins: typeof plainCoins = [];

    for (const coin of plainCoins) {
        if (coins.reduce((sum, chosen) => sum + BigInt(chosen.valueSatoshis), 0n) >= satoshis + 500n) {
            break;
        }

        coins.push(coin);
    }

    if (!intent || coins.reduce((sum, chosen) => sum + BigInt(chosen.valueSatoshis), 0n) < satoshis + 500n) {
        throw new Error(`Cannot pay ${satoshis} sats: no sendSatoshis intent or not enough plain BCH.`);
    }

    const created = await engine.createInvitation({
        templateIdentifier: p2pkhIdentifier,
        actionIdentifier: 'sendSatoshis',
        intent,
        variables: [
            { variableIdentifier: 'transferredSatoshis', roleIdentifier: 'sender', value: satoshis },
            { variableIdentifier: 'recipientLockingscript', roleIdentifier: 'sender', value: binToHex(lockingBytecode) },
        ],
        inputs: coins.map((coin) => ({ outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex })),
    });

    await engine.appendInvitation(created.invitation.invitationIdentifier, { templateIdentifier: p2pkhIdentifier, actionIdentifier: 'sendSatoshis', outputs: [{ outputIdentifier: 'transferSatoshisOutput' }] });

    const paid = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'badgers-stake-mint-funding' });

    if (!paid.serializedTransaction) {
        throw new Error('The engine did not return the funding transaction, so the output index is unknown.');
    }

    return { transactionHash: paid.transactionHash, outputIndex: findOutputIndex(paid.serializedTransaction, lockingBytecode) };
}

const engine = await createChipnetEngine(loadOrCreateMnemonic(FOLDER), FOLDER);

try {
    const { templateIdentifier: p2pkhIdentifier } = await engine.importTemplate(serializeTemplate(p2pkhTemplate));

    await engine.setDefaultPolicies({
        change: { templateIdentifier: p2pkhIdentifier },
        receive: { templateIdentifier: p2pkhIdentifier },
        address: { templateIdentifier: p2pkhIdentifier },
    });

    const state = readState();

    if (mode === 'release') {
        await engine.archiveInvitation(process.argv[3] as string);
        console.log(`\nRELEASED the coins reserved by ${process.argv[3]}`);
    } else if (mode === 'mint') {
        if (state.genesisTransactionHash) {
            throw new Error(`Already minted ${state.testCategory} in ${state.genesisTransactionHash}. Run "deploy" next.`);
        }

        const minter = loadOrCreateMinterKey(FOLDER);

        // The admin address receives the masterBadger and, as genesis change, the coin that later authorises withdrawals.
        state.adminLockingBytecode ??= await engine.generateLockingBytecodeFromDefaultPolicy('receive');
        writeState(state);

        if (state.mintFundingTransactionHash === undefined || state.mintFundingOutputIndex === undefined) {
            step(`Paying ${MINT_FUNDING_SATS} sats to the minter key (p2pkh template, sendSatoshis)`);

            const funding = await payTo(engine, p2pkhIdentifier, minter.lockingBytecode, MINT_FUNDING_SATS);

            state.mintFundingTransactionHash = funding.transactionHash;
            state.mintFundingOutputIndex = funding.outputIndex;
            writeState(state);
        }

        step(`Test masterBadger genesis from ${state.mintFundingTransactionHash}:${state.mintFundingOutputIndex}`);

        const admin = hexToBin(state.adminLockingBytecode);
        const genesis = buildFungibleGenesis({
            minter,
            coin: { transactionHash: state.mintFundingTransactionHash, outputIndex: state.mintFundingOutputIndex, valueSatoshis: MINT_FUNDING_SATS },
            tokenAmount: SUPPLY,
            tokenSatoshis: MASTER_SATS,
            tokenRecipient: admin,
            changeRecipient: admin,
            nft: { capability: 'minting', commitment: new Uint8Array() },
        });

        state.genesisTransactionHash = await broadcastToChipnet(genesis.serializedTransaction);
        state.testCategory = genesis.category;
        writeState(state);
        console.log(`  BROADCAST ${state.genesisTransactionHash}\n  test masterBadger category ${genesis.category}: a minting NFT with ${SUPPLY} BadgerCoins`);
        console.log('\nMINTED. Next:  npx tsx badgers-stake/scripts/chipnet.ts deploy');
    } else {
        if (!state.testCategory || !state.adminLockingBytecode) {
            throw new Error('No test masterBadger yet: run "mint" first.');
        }

        const templateJson = variantTemplateJson(state.testCategory);
        const templateIdentifier = generateTemplateIdentifier(parseTemplate(templateJson));

        await engine.importTemplate(templateJson);

        const template = await engine.getTemplate(templateIdentifier);

        if (!template) {
            throw new Error('Variant template missing after import.');
        }

        const contractLock = compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, 'badgerLockingScript', {});
        const contractScriptHash = scriptHashOf(contractLock);
        const admin = hexToBin(state.adminLockingBytecode);
        const intentFor = (action: string) => {
            const intent = template.start?.find((entry) => entry.action === action);

            if (!intent) {
                throw new Error(`${action} start intent not found.`);
            }

            return intent;
        };
        const masterBadger = async () =>
            (await engine.listUnspentOutputs()).find(
                (output) => output.scriptHash === contractScriptHash && output.tokenCategory === state.testCategory && output.tokenNftCapability === 'minting' && output.reservedBy === undefined,
            );

        console.log(`  Badgers Stake (chipnet test variant) ${templateIdentifier}\n  contract ${binToHex(contractLock)}`);

        if (mode === 'deploy') {
            const nftCoin = await waitFor('the test masterBadger in the wallet', async () =>
                (await engine.listUnspentOutputs()).find((output) => output.tokenCategory === state.testCategory && output.tokenNftCapability === 'minting' && output.scriptHash !== contractScriptHash),
            );
            const adminCoin = `${state.genesisTransactionHash}:1`;
            const feeCoin = (await engine.listSpendableUnspentOutputs())
                .filter((output) => output.tokenCategory === undefined && `${output.outpointTransactionHash}:${output.outpointIndex}` !== adminCoin)
                .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

            if (!feeCoin) {
                throw new Error('No plain BCH coin (other than the admin coin) to pay the deploy fee.');
            }

            step(`Deploying the masterBadger ${nftCoin.outpointTransactionHash}:${nftCoin.outpointIndex} with a 100-sat staking fee`);

            const created = await engine.createInvitation({
                templateIdentifier,
                actionIdentifier: 'deploy',
                intent: intentFor('deploy'),
                variables: [
                    { variableIdentifier: 'masterSatoshis', roleIdentifier: 'admin', value: MASTER_SATS },
                    { variableIdentifier: 'masterTokenAmount', roleIdentifier: 'admin', value: BigInt(nftCoin.tokenAmount ?? '0') },
                    { variableIdentifier: 'newStakeFee', roleIdentifier: 'admin', value: 100n },
                    { variableIdentifier: 'adminPublicKeyHash', roleIdentifier: 'admin', value: binToHex(admin.slice(3, 23)) },
                ],
                inputs: [
                    { outpointTransactionHash: hexToBin(nftCoin.outpointTransactionHash), outpointIndex: nftCoin.outpointIndex },
                    { outpointTransactionHash: hexToBin(feeCoin.outpointTransactionHash), outpointIndex: feeCoin.outpointIndex },
                ],
            });

            // Tracked for the admin role, so this wallet watches the contract and can unlock the masterBadger later.
            await engine.appendInvitation(created.invitation.invitationIdentifier, {
                templateIdentifier,
                actionIdentifier: 'deploy',
                outputs: [{ outputIdentifier: 'masterDeployOutput', roleIdentifier: 'admin' }],
            });

            const deployed = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'badgers-stake-deploy' });

            state.deployTransactionHash = deployed.transactionHash;
            writeState(state);
            console.log(`\nDEPLOYED ${deployed.transactionHash}. Next:  npx tsx badgers-stake/scripts/chipnet.ts withdraw`);
        } else if (mode === 'withdraw') {
            const master = await waitFor('the deployed masterBadger', masterBadger);
            const adminScriptHash = scriptHashOf(admin);
            const adminCoin = (await engine.listSpendableUnspentOutputs())
                .filter((output) => output.scriptHash === adminScriptHash && output.tokenCategory === undefined)
                .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

            if (!adminCoin) {
                throw new Error('No plain BCH coin at the admin address to authorise the withdrawal.');
            }

            const newStakeFee = BigInt(process.env.NEW_FEE ?? '250');
            const recipient = await engine.generateLockingBytecodeFromDefaultPolicy('receive');

            step(`Withdrawing ${master.valueSatoshis} sats from the masterBadger with the admin coin ${adminCoin.outpointTransactionHash}:${adminCoin.outpointIndex} (${adminCoin.valueSatoshis} sats); new fee ${newStakeFee}`);

            const created = await engine.createInvitation({
                templateIdentifier,
                actionIdentifier: 'withdraw',
                intent: intentFor('withdraw'),
                variables: [
                    { variableIdentifier: 'masterSatoshis', roleIdentifier: 'admin', value: BigInt(master.valueSatoshis) },
                    { variableIdentifier: 'masterTokenAmount', roleIdentifier: 'admin', value: BigInt(master.tokenAmount ?? '0') },
                    { variableIdentifier: 'masterCommitment', roleIdentifier: 'admin', value: master.tokenNftCommitment ?? '' },
                    { variableIdentifier: 'newStakeFee', roleIdentifier: 'admin', value: newStakeFee },
                    { variableIdentifier: 'adminCoinSatoshis', roleIdentifier: 'admin', value: BigInt(adminCoin.valueSatoshis) },
                    { variableIdentifier: 'withdrawLockingScript', roleIdentifier: 'admin', value: recipient },
                ],
                inputs: [
                    { inputIdentifier: 'masterWithdrawInput', outpointTransactionHash: hexToBin(master.outpointTransactionHash), outpointIndex: master.outpointIndex },
                    { inputIdentifier: 'adminCoinInput', outpointTransactionHash: hexToBin(adminCoin.outpointTransactionHash), outpointIndex: adminCoin.outpointIndex },
                ],
            });

            await engine.appendInvitation(created.invitation.invitationIdentifier, {
                templateIdentifier,
                actionIdentifier: 'withdraw',
                outputs: [{ outputIdentifier: 'masterAfterWithdrawOutput', roleIdentifier: 'admin' }, { outputIdentifier: 'withdrawOutput' }],
            });

            // Exactly two outputs: the contract allows no change.
            const withdrawn = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'badgers-stake-withdraw', addChange: false });

            state.withdrawTransactionHashes = [...(state.withdrawTransactionHashes ?? []), withdrawn.transactionHash];
            writeState(state);
            console.log(`\nWITHDRAWN ${withdrawn.transactionHash}`);
        } else if (mode === 'stake') {
            const master = await waitFor('the deployed masterBadger', masterBadger);
            const stakeSatoshis = BigInt(process.env.STAKE_SATS ?? '5000');
            const stakeBlocks = BigInt(process.env.STAKE_BLOCKS ?? String((SATOSHIS_PER_COIN + stakeSatoshis - 1n) / stakeSatoshis));
            const coin = (await engine.listSpendableUnspentOutputs())
                .filter((output) => output.tokenCategory === undefined && output.scriptHash !== scriptHashOf(admin))
                .sort((a, b) => Number(BigInt(b.valueSatoshis) - BigInt(a.valueSatoshis)))[0];

            if (!coin) {
                throw new Error('No plain BCH coin to stake from.');
            }

            // The contract sends change to the coin's own address and reads the staker's key hash from it.
            const coinLock = (await engine.listScriptHashData({ scriptHash: coin.scriptHash }))[0]?.lockingBytecode;

            if (!coinLock || !coinLock.startsWith('76a914')) {
                throw new Error(`Coin ${coin.outpointTransactionHash}:${coin.outpointIndex} is not at a known P2PKH address.`);
            }

            step(`Staking ${stakeSatoshis} sats for ${stakeBlocks} blocks from ${coin.outpointTransactionHash}:${coin.outpointIndex} (${coin.valueSatoshis} sats)`);

            const created = await engine.createInvitation({
                templateIdentifier,
                actionIdentifier: 'stake',
                intent: intentFor('stake'),
                variables: [
                    { variableIdentifier: 'masterSatoshis', roleIdentifier: 'staker', value: BigInt(master.valueSatoshis) },
                    { variableIdentifier: 'masterTokenAmount', roleIdentifier: 'staker', value: BigInt(master.tokenAmount ?? '0') },
                    { variableIdentifier: 'masterCommitment', roleIdentifier: 'staker', value: master.tokenNftCommitment ?? '' },
                    { variableIdentifier: 'stakeSatoshis', roleIdentifier: 'staker', value: stakeSatoshis },
                    { variableIdentifier: 'stakeBlocks', roleIdentifier: 'staker', value: stakeBlocks },
                    { variableIdentifier: 'stakerPublicKeyHash', roleIdentifier: 'staker', value: coinLock.slice(6, 46) },
                    { variableIdentifier: 'stakerCoinSatoshis', roleIdentifier: 'staker', value: BigInt(coin.valueSatoshis) },
                ],
                inputs: [
                    { inputIdentifier: 'masterStakeInput', outpointTransactionHash: hexToBin(master.outpointTransactionHash), outpointIndex: master.outpointIndex },
                    { inputIdentifier: 'stakerCoinInput', outpointTransactionHash: hexToBin(coin.outpointTransactionHash), outpointIndex: coin.outpointIndex },
                ],
            });

            await engine.appendInvitation(created.invitation.invitationIdentifier, {
                templateIdentifier,
                actionIdentifier: 'stake',
                outputs: [
                    { outputIdentifier: 'masterAfterStakeOutput', roleIdentifier: 'staker' },
                    { outputIdentifier: 'lockOutput', roleIdentifier: 'staker' },
                    { outputIdentifier: 'stakeChangeOutput' },
                ],
            });

            const staked = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'badgers-stake-stake', addChange: false });

            state.stakeTransactionHash = staked.transactionHash;
            state.stakeBlocks = Number(stakeBlocks);
            writeState(state);
            console.log(`\nSTAKED ${staked.transactionHash}. After ${stakeBlocks} blocks:  npx tsx badgers-stake/scripts/chipnet.ts unstake`);
        } else {
            const lock = (await engine.listUnspentOutputs()).find(
                (output) => output.scriptHash === contractScriptHash && output.tokenCategory === state.testCategory && output.tokenNftCapability === 'mutable' && output.reservedBy === undefined,
            );

            if (!lock || !lock.tokenNftCommitment || lock.minedAtHeight === undefined) {
                throw new Error('No confirmed stake lock in view: run "stake" first.');
            }

            const stakeBlocks = BigInt(hexToBin(lock.tokenNftCommitment.slice(76, 80)).reduce((sum, byte, index) => sum + byte * 256 ** index, 0));
            const tip = await getChipnetTipHeight();

            if (BigInt(tip + 1 - lock.minedAtHeight) < stakeBlocks) {
                throw new Error(`The lock needs ${stakeBlocks} blocks; it is ${tip - lock.minedAtHeight} blocks old.`);
            }

            step(`Releasing ${lock.outpointTransactionHash}:${lock.outpointIndex} (${lock.valueSatoshis} sats, ${lock.tokenAmount} BadgerCoins)`);

            const created = await engine.createInvitation({
                templateIdentifier,
                actionIdentifier: 'unstake',
                intent: intentFor('unstake'),
                variables: [
                    { variableIdentifier: 'lockSatoshis', roleIdentifier: 'staker', value: BigInt(lock.valueSatoshis) },
                    { variableIdentifier: 'lockTokenAmount', roleIdentifier: 'staker', value: BigInt(lock.tokenAmount ?? '0') },
                    { variableIdentifier: 'stakeBlocks', roleIdentifier: 'staker', value: stakeBlocks },
                    { variableIdentifier: 'stakerPublicKeyHash', roleIdentifier: 'staker', value: lock.tokenNftCommitment.slice(0, 40) },
                ],
                inputs: [{ inputIdentifier: 'lockInput', outpointTransactionHash: hexToBin(lock.outpointTransactionHash), outpointIndex: lock.outpointIndex }],
            });

            await engine.appendInvitation(created.invitation.invitationIdentifier, {
                templateIdentifier,
                actionIdentifier: 'unstake',
                outputs: [{ outputIdentifier: 'badgerCoinOutput' }, { outputIdentifier: 'honeyOutput' }, { outputIdentifier: 'unstakedOutput' }],
            });

            const released = await signAndBroadcast(engine, created.invitation.invitationIdentifier, { folder: FOLDER, label: 'badgers-stake-unstake', addChange: false });

            state.unstakeTransactionHash = released.transactionHash;
            writeState(state);
            console.log(`\nRELEASED ${released.transactionHash}`);
        }
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
