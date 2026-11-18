/**
 * The BadgerStake contract (BadgerStake.cash, unchanged from upstream) in Libauth's BCH 2026 VM, with real token data
 * and signed P2PKH coins for the staker and the admin.
 */
import { bigIntToVmNumber, cashAssemblyToBin, encodeDataPush, hash256, hexToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import artifact from '../artifact/BadgerStake.json' with { type: 'json' };
import { artifactAsmToCashAssembly } from '../../shared/cashscript.js';
import { p2pkhLockingBytecode, testKey, verifySpend, type SpentCoin } from '../../shared/vm.js';

const REDEEM_SCRIPT = cashAssemblyToBin(artifactAsmToCashAssembly(artifact.bytecode)) as Uint8Array;
const BADGER_LOCK = new Uint8Array([0xaa, 0x20, ...hash256(REDEEM_SCRIPT), 0x87]);
// The hard-coded masterBadger category, in Libauth's (display) byte order.
const CATEGORY = hexToBin('242f6ecedb404c743477e35b09733a56cacae34f3109d5cee1cbc1d5630affd7');
const ADMIN = testKey(2);
const STAKER = testKey(3);
const STRANGER = testKey(4);
const SUPPLY = 1_000_000_000n;
const FEE = 1000n;

const bytes2 = (value: bigint): Uint8Array => {
    const number = bigIntToVmNumber(value);

    return new Uint8Array([number[0] ?? 0, number[1] ?? 0]);
};
const commitmentOf = (fee: bigint, adminHash = ADMIN.publicKeyHash): Uint8Array => new Uint8Array([...bytes2(fee), ...new Uint8Array(18), ...adminHash]);
const lockCommitment = (stakeBlocks: bigint, stakerHash = STAKER.publicKeyHash): Uint8Array => new Uint8Array([...stakerHash, ...new Uint8Array(18), ...bytes2(stakeBlocks)]);

/** Unlocking bytecode for a contract input: the function arguments (reversed), the selector, then the redeem script. */
const unlock = (...pushes: Uint8Array[]): Uint8Array => new Uint8Array([...pushes.flatMap((push) => [...encodeDataPush(push)]), ...encodeDataPush(REDEEM_SCRIPT)]);
const num = (value: bigint): Uint8Array => bigIntToVmNumber(value);

const master = (unlocking: Uint8Array, value = 5000n, commitment = commitmentOf(FEE)): SpentCoin => ({
    lockingBytecode: BADGER_LOCK,
    unlockingBytecode: unlocking,
    valueSatoshis: value,
    token: { category: CATEGORY, amount: SUPPLY, nft: { capability: 'minting', commitment } },
});
const coinOf = (key: ReturnType<typeof testKey>, valueSatoshis: bigint): SpentCoin => ({ lockingBytecode: p2pkhLockingBytecode(key.publicKeyHash), unlockingBytecode: new Uint8Array(), valueSatoshis, signingKey: key.privateKey });
const to = (key: ReturnType<typeof testKey>, valueSatoshis: bigint, token?: Output['token']): Output => ({ lockingBytecode: p2pkhLockingBytecode(key.publicKeyHash), valueSatoshis, ...(token ? { token } : {}) });

// ---- lock(): 1 BCH for 144 blocks earns 144 BadgerCoins.
const AMOUNT = 100_000_000n;
const BLOCKS = 144n;
const REWARD = 144n;
const COIN = 101_000_000n;

function stake(overrides: { blocks?: bigint; amount?: bigint; reward?: bigint; coin?: SpentCoin; outputs?: Output[]; masterValue?: bigint } = {}): true | string {
    const blocks = overrides.blocks ?? BLOCKS;
    const amount = overrides.amount ?? AMOUNT;
    const reward = overrides.reward ?? (amount * blocks) / 100_000_000n;
    const masterValue = overrides.masterValue ?? 5000n;

    return verifySpend(
        [master(unlock(STAKER.publicKeyHash, num(blocks), num(amount), new Uint8Array())), overrides.coin ?? coinOf(STAKER, COIN)],
        overrides.outputs ?? [
            { lockingBytecode: BADGER_LOCK, valueSatoshis: masterValue + FEE, token: { category: CATEGORY, amount: SUPPLY - reward, nft: { capability: 'minting', commitment: commitmentOf(FEE) } } },
            { lockingBytecode: BADGER_LOCK, valueSatoshis: amount, token: { category: CATEGORY, amount: reward, nft: { capability: 'mutable', commitment: lockCommitment(blocks) } } },
            to(STAKER, COIN - amount - FEE - 2000n),
        ],
    );
}

// ---- unlock(): the lock made above, after its 144 blocks.
const lockCoin = (sequenceNumber = Number(BLOCKS)): SpentCoin => ({
    lockingBytecode: BADGER_LOCK,
    unlockingBytecode: unlock(num(1n)),
    valueSatoshis: AMOUNT,
    token: { category: CATEGORY, amount: REWARD, nft: { capability: 'mutable', commitment: lockCommitment(BLOCKS) } },
    sequenceNumber,
});
const honeyCommitment = new Uint8Array([0x00, 0x00, ...bigIntToVmNumber(REWARD)]);
const releaseOutputs = (recipient = STAKER, honey = honeyCommitment): Output[] => [
    to(recipient, 1000n, { category: CATEGORY, amount: REWARD }),
    to(recipient, 1000n, { category: CATEGORY, amount: 0n, nft: { capability: 'none', commitment: honey } }),
    to(recipient, AMOUNT - 3000n),
];

// ---- withdraw(newFee): the admin collects the masterBadger's satoshis.
function withdraw(overrides: { signer?: ReturnType<typeof testKey>; newCommitment?: Uint8Array; newFee?: bigint } = {}): true | string {
    const newFee = overrides.newFee ?? 500n;

    return verifySpend(
        [master(unlock(num(newFee), num(2n)), 50_000n), coinOf(overrides.signer ?? ADMIN, 3000n)],
        [
            { lockingBytecode: BADGER_LOCK, valueSatoshis: 1000n, token: { category: CATEGORY, amount: SUPPLY, nft: { capability: 'minting', commitment: overrides.newCommitment ?? commitmentOf(newFee) } } },
            to(ADMIN, 50_000n + 3000n - 2000n),
        ],
    );
}

const CONTRACT_REJECTED = /error in evaluating input index 0/;

describe('BadgerStake contract (BadgerStake.cash)', () => {
    describe('lock()', () => {
        it('accepts a stake: the fee to the masterBadger, the reward into a lock NFT, change back to the staker', () => {
            expect(stake()).toBe(true);
        });

        it('accepts a stake with no change output', () => {
            expect(
                stake({
                    coin: coinOf(STAKER, AMOUNT + FEE + 2000n),
                    outputs: [
                        { lockingBytecode: BADGER_LOCK, valueSatoshis: 6000n, token: { category: CATEGORY, amount: SUPPLY - REWARD, nft: { capability: 'minting', commitment: commitmentOf(FEE) } } },
                        { lockingBytecode: BADGER_LOCK, valueSatoshis: AMOUNT, token: { category: CATEGORY, amount: REWARD, nft: { capability: 'mutable', commitment: lockCommitment(BLOCKS) } } },
                    ],
                }),
            ).toBe(true);
        });

        it('accepts the longest working period, 32767 blocks', () => {
            expect(stake({ blocks: 32_767n })).toBe(true);
        });

        it('rejects a reward one BadgerCoin above the formula', () => {
            expect(stake({ reward: REWARD + 1n })).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a stake below 5000 satoshis, and one that earns nothing', () => {
            expect(stake({ amount: 4999n, blocks: 30_000n })).toMatch(CONTRACT_REJECTED);
            expect(stake({ amount: 5000n, blocks: 100n })).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a coin that is not at the staker’s key hash', () => {
            expect(stake({ coin: coinOf(STRANGER, COIN) })).toMatch(CONTRACT_REJECTED);
        });

        it('rejects change sent anywhere but the staker’s address', () => {
            expect(
                stake({
                    outputs: [
                        { lockingBytecode: BADGER_LOCK, valueSatoshis: 6000n, token: { category: CATEGORY, amount: SUPPLY - REWARD, nft: { capability: 'minting', commitment: commitmentOf(FEE) } } },
                        { lockingBytecode: BADGER_LOCK, valueSatoshis: AMOUNT, token: { category: CATEGORY, amount: REWARD, nft: { capability: 'mutable', commitment: lockCommitment(BLOCKS) } } },
                        to(STRANGER, COIN - AMOUNT - FEE - 2000n),
                    ],
                }),
            ).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a stake that skips the staking fee', () => {
            expect(stake({ masterValue: 5000n - FEE })).toMatch(CONTRACT_REJECTED);
        });
    });

    describe('unlock()', () => {
        it('accepts a release after the period: BadgerCoins, a Honey NFT and the BCH less 3000 sats, all to the staker', () => {
            expect(verifySpend([lockCoin()], releaseOutputs())).toBe(true);
        });

        it('rejects a release before the period has passed', () => {
            expect(verifySpend([lockCoin(Number(BLOCKS) - 1)], releaseOutputs())).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a release to anyone but the staker', () => {
            expect(verifySpend([lockCoin()], releaseOutputs(STRANGER))).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a Honey NFT that does not record the reward', () => {
            expect(verifySpend([lockCoin()], releaseOutputs(STAKER, new Uint8Array([0x00, 0x00, 0x01])))).toMatch(CONTRACT_REJECTED);
        });
    });

    describe('withdraw()', () => {
        it('accepts the admin withdrawing the fees and setting a new fee', () => {
            expect(withdraw()).toBe(true);
        });

        it('rejects a withdrawal signed by anyone but the admin', () => {
            expect(withdraw({ signer: STRANGER })).toMatch(CONTRACT_REJECTED);
        });

        it('rejects a withdrawal that also replaces the admin key hash', () => {
            expect(withdraw({ newCommitment: commitmentOf(500n, STRANGER.publicKeyHash) })).toMatch(CONTRACT_REJECTED);
        });
    });

    describe('findings (see README)', () => {
        it('the contract allows up to 65536 blocks, but stores the period in 2 bytes: 32768 and above fail', () => {
            expect(stake({ blocks: 32_768n })).toMatch(CONTRACT_REJECTED);
            expect(stake({ blocks: 65_536n })).toMatch(CONTRACT_REJECTED);
        });

        it('anyone can release a finished stake (no signature), but only to the staker', () => {
            // lockCoin's unlocking is just the selector: no key is involved.
            expect(verifySpend([lockCoin()], releaseOutputs())).toBe(true);
        });
    });
});
