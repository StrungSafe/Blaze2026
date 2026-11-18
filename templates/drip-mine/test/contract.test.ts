/**
 * The Drip Mine contract (drip-mine.cash, unchanged from upstream) in Libauth's BCH 2026 VM.
 */
import { encodeDataPush, hash256, hexToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { p2pkhLockingBytecode, testKey, verifySpend, type SpentCoin } from '../../shared/vm.js';

// The deployed redeem script (see drip-mine/README.md) and its P2SH32 lock.
const REDEEM_SCRIPT = hexToBin('51b275c3519dc4519d02400202a400c0c67b527993a063c0c7c0cd88c0c60228119504c685744f966ea063787768c0c6c0cc946ea2696d67c0cc009dc0cd016a88687551');
const DRIP_LOCK = new Uint8Array([0xaa, 0x20, ...hash256(REDEEM_SCRIPT), 0x87]);
const UNLOCK = encodeDataPush(REDEEM_SCRIPT);
const OP_RETURN = new Uint8Array([0x6a]);

// A rejection by the contract itself (input 0 is the Drip Mine coin), not by a standardness or consensus rule.
const CONTRACT_REJECTED = /error in evaluating input index 0/;

/** A Drip Mine coin spent with sequence number 1, the one-block relative timelock the contract requires. */
function dripCoin(valueSatoshis: bigint, sequenceNumber = 1): SpentCoin {
    return { lockingBytecode: DRIP_LOCK, unlockingBytecode: UNLOCK, valueSatoshis, sequenceNumber };
}

/** The largest payout the contract allows: max(value * 4392 / 1333036486, 164), with floor division. */
function maxPayout(value: bigint): bigint {
    const proportional = (value * 4392n) / 1333036486n;

    return proportional > 164n ? proportional : 164n;
}

const back = (valueSatoshis: bigint): Output => ({ lockingBytecode: DRIP_LOCK, valueSatoshis });
const terminal: Output = { lockingBytecode: OP_RETURN, valueSatoshis: 0n };

describe('Drip Mine contract (drip-mine.cash)', () => {
    describe('accepts', () => {
        it('a drip of the full proportional payout from a large coin (1 BCH pays 329 sats)', () => {
            expect(maxPayout(100_000_000n)).toBe(329n);
            expect(verifySpend([dripCoin(100_000_000n)], [back(100_000_000n - 329n)])).toBe(true);
        });

        it('a drip that pays less than the maximum', () => {
            expect(verifySpend([dripCoin(100_000_000n)], [back(100_000_000n - 200n)])).toBe(true);
        });

        it('the flat 164-sat payout when the proportional one is smaller', () => {
            expect(verifySpend([dripCoin(50_000n)], [back(50_000n - 164n)])).toBe(true);
        });

        it('a drip from the smallest drippable coin (741 sats leaves 577, just above the 576 dust limit)', () => {
            expect(verifySpend([dripCoin(741n)], [back(577n)])).toBe(true);
        });

        it('terminating a coin of 740 sats or less into a bare 0-sat OP_RETURN', () => {
            expect(verifySpend([dripCoin(740n)], [terminal])).toBe(true);
            expect(verifySpend([dripCoin(576n)], [terminal])).toBe(true);
        });
    });

    describe('rejects', () => {
        it('a payout one satoshi above the maximum', () => {
            expect(verifySpend([dripCoin(100_000_000n)], [back(100_000_000n - 330n)])).toMatch(CONTRACT_REJECTED);
            expect(verifySpend([dripCoin(50_000n)], [back(50_000n - 165n)])).toMatch(CONTRACT_REJECTED);
        });

        it('a spend without the one-block relative timelock (sequence number 0 or final)', () => {
            expect(verifySpend([dripCoin(100_000_000n, 0)], [back(100_000_000n - 329n)])).toMatch(CONTRACT_REJECTED);
            expect(verifySpend([dripCoin(100_000_000n, 0xffffffff)], [back(100_000_000n - 329n)])).toMatch(CONTRACT_REJECTED);
        });

        it('the remainder sent anywhere but back to the Drip Mine', () => {
            expect(verifySpend([dripCoin(100_000_000n)], [{ lockingBytecode: p2pkhLockingBytecode(testKey(9).publicKeyHash), valueSatoshis: 100_000_000n - 329n }])).toMatch(CONTRACT_REJECTED);
        });

        it('a second output (the drip cannot pay anyone)', () => {
            expect(verifySpend([dripCoin(100_000_000n)], [back(100_000_000n - 1329n), { lockingBytecode: p2pkhLockingBytecode(testKey(9).publicKeyHash), valueSatoshis: 1000n }])).toMatch(CONTRACT_REJECTED);
        });

        it('two Drip Mine coins in one transaction (each coin drips alone)', () => {
            expect(verifySpend([dripCoin(100_000_000n), dripCoin(100_000_000n)], [back(200_000_000n - 658n)])).toMatch(CONTRACT_REJECTED);
        });

        it('terminating a coin above 740 sats (it must drip instead)', () => {
            expect(verifySpend([dripCoin(741n)], [terminal])).toMatch(CONTRACT_REJECTED);
        });

        it('dripping a coin of 740 sats or less (it must terminate instead)', () => {
            expect(verifySpend([dripCoin(740n)], [back(576n)])).toMatch(CONTRACT_REJECTED);
        });

        it('a terminal output other than a bare 0-sat OP_RETURN', () => {
            expect(verifySpend([dripCoin(700n)], [{ lockingBytecode: new Uint8Array([0x6a, 0x00]), valueSatoshis: 0n }])).toMatch(CONTRACT_REJECTED);
            expect(verifySpend([dripCoin(700n)], [{ lockingBytecode: OP_RETURN, valueSatoshis: 100n }])).toMatch(CONTRACT_REJECTED);
        });
    });
});
