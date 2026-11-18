/**
 * The BlockPoints vault (upstream v3.2, unchanged) in Libauth's BCH 2026 VM, with real token data.
 *
 * The claimant's coin is an anyone-can-spend stand-in for a wallet coin, so the tests exercise only the vault's rules.
 * The VM checks relative timelocks against the sequence numbers given here; the network checks them against real
 * coin ages.
 */
import { bigIntToVmNumber, encodeDataPush, hash256, hexToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { ANYONE_CAN_SPEND, p2pkhLockingBytecode, testKey, verifySpend, type SpentCoin } from '../../shared/vm.js';

// The deployed redeem script (see block-points/README.md) and its P2SH32 lock.
const REDEEM_SCRIPT = hexToBin('c2529d03ffff0078a26900cb78a26976b275c0d3c0d07b00c6950400e1f5059694a269c0d1c0ce88c0cdc0c788c0519c');
const VAULT_LOCK = new Uint8Array([0xaa, 0x20, ...hash256(REDEEM_SCRIPT), 0x87]);
const CATEGORY = new Uint8Array(32).fill(0xbb);
const OTHER_CATEGORY = new Uint8Array(32).fill(0xcc);
const THREAD_TOKENS = 1_000_000_000n;
const CLAIMANT_LOCK: Uint8Array = p2pkhLockingBytecode(testKey(7).publicKeyHash);

// A rejection by the vault itself (the vault is input 1), not by a standardness or consensus rule.
const VAULT_REJECTED = /error in evaluating input index 1/;

const claimantCoin = (valueSatoshis: bigint, sequenceNumber: number): SpentCoin => ({ lockingBytecode: ANYONE_CAN_SPEND, unlockingBytecode: new Uint8Array(), valueSatoshis, sequenceNumber });

function thread(age: bigint, sequenceNumber = Number(age), amount = THREAD_TOKENS): SpentCoin {
    return {
        lockingBytecode: VAULT_LOCK,
        unlockingBytecode: new Uint8Array([...encodeDataPush(bigIntToVmNumber(age)), ...encodeDataPush(REDEEM_SCRIPT)]),
        valueSatoshis: 800n,
        token: { category: CATEGORY, amount },
        sequenceNumber,
    };
}

const reward = (amount: bigint, category = CATEGORY): Output => ({ lockingBytecode: CLAIMANT_LOCK, valueSatoshis: 800n, token: { category, amount } });
const threadBack = (amount: bigint, valueSatoshis = 800n, lockingBytecode: Uint8Array = VAULT_LOCK, category = CATEGORY): Output => ({ lockingBytecode, valueSatoshis, token: { category, amount } });

/** A claim with a 1 BCH coin held 144 blocks: an allowance of 144 tokens. */
function claim(rewardAmount: bigint, overrides: { coins?: SpentCoin[]; outputs?: Output[]; version?: number } = {}): true | string {
    return verifySpend(
        overrides.coins ?? [claimantCoin(100_000_000n, 144), thread(144n)],
        overrides.outputs ?? [reward(rewardAmount), threadBack(THREAD_TOKENS - rewardAmount)],
        { version: overrides.version ?? 2 },
    );
}

describe('BlockPoints vault (v3.2)', () => {
    describe('accepts', () => {
        it('the full allowance: a 1 BCH coin held 144 blocks claims 144 tokens', () => {
            expect(claim(144n)).toBe(true);
        });

        it('a claim below the allowance', () => {
            expect(claim(100n)).toBe(true);
        });

        it('the largest age, 65535 blocks', () => {
            expect(verifySpend([claimantCoin(100_000_000n, 65535), thread(65535n)], [reward(65535n), threadBack(THREAD_TOKENS - 65535n)])).toBe(true);
        });

        it('extra inputs and outputs after the thread (a fee coin and change)', () => {
            expect(
                verifySpend(
                    [claimantCoin(100_000_000n, 144), thread(144n), { lockingBytecode: ANYONE_CAN_SPEND, unlockingBytecode: new Uint8Array(), valueSatoshis: 5000n }],
                    [reward(144n), threadBack(THREAD_TOKENS - 144n), { lockingBytecode: CLAIMANT_LOCK, valueSatoshis: 4000n }],
                ),
            ).toBe(true);
        });
    });

    describe('rejects', () => {
        it('a reward one token above the allowance', () => {
            expect(claim(145n)).toMatch(VAULT_REJECTED);
        });

        it('an age above 65535 blocks', () => {
            expect(verifySpend([claimantCoin(100_000_000n, 65536), thread(65536n)], [reward(65536n), threadBack(THREAD_TOKENS - 65536n)])).toMatch(VAULT_REJECTED);
        });

        it('a claimant coin whose sequence number is below the claimed age', () => {
            expect(claim(144n, { coins: [claimantCoin(100_000_000n, 143), thread(144n)] })).toMatch(VAULT_REJECTED);
        });

        it('a thread whose own sequence number is below the claimed age (its relative timelock)', () => {
            expect(claim(144n, { coins: [claimantCoin(100_000_000n, 144), thread(144n, 143)] })).toMatch(VAULT_REJECTED);
        });

        it('the thread anywhere but input 1', () => {
            expect(verifySpend([thread(144n), claimantCoin(100_000_000n, 144)], [threadBack(THREAD_TOKENS - 144n), reward(144n)])).toMatch(/error in evaluating input index 0/);
        });

        it('the thread returned to another address', () => {
            expect(claim(144n, { outputs: [reward(144n), threadBack(THREAD_TOKENS - 144n, 800n, CLAIMANT_LOCK)] })).toMatch(VAULT_REJECTED);
        });

        it('the thread returned holding a different token category', () => {
            const otherCoin: SpentCoin = { lockingBytecode: ANYONE_CAN_SPEND, unlockingBytecode: new Uint8Array(), valueSatoshis: 800n, token: { category: OTHER_CATEGORY, amount: THREAD_TOKENS } };

            expect(
                verifySpend(
                    [claimantCoin(100_000_000n, 144), thread(144n), otherCoin],
                    [reward(THREAD_TOKENS), threadBack(THREAD_TOKENS, 800n, VAULT_LOCK, OTHER_CATEGORY)],
                ),
            ).toMatch(VAULT_REJECTED);
        });

        it('a version 1 transaction, where sequence numbers are not timelocks', () => {
            expect(claim(144n, { version: 1 })).toMatch(VAULT_REJECTED);
        });
    });

    describe('findings (accepted by the contract, see README)', () => {
        it('a claimant coin with the BIP68 disable bit set: the contract accepts it, so the network never checks that coin’s age', () => {
            expect(claim(144n, { coins: [claimantCoin(100_000_000n, 0xffffffff), thread(144n)] })).toBe(true);
        });

        it('a thread returned with fewer satoshis: the contract does not check the thread’s value', () => {
            expect(claim(144n, { outputs: [reward(144n), threadBack(THREAD_TOKENS - 144n, 700n)] })).toBe(true);
        });
    });
});
