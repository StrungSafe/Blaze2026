/**
 * The TokenBurner contract (burner.cash, unchanged from upstream) in Libauth's BCH 2026 VM. Burner coins carry real
 * token data, so the VM also applies the CashTokens consensus rules.
 */
import { encodeDataPush, hash256, hexToBin, utf8ToBin, type Output } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { ANYONE_CAN_SPEND, p2pkhLockingBytecode, testKey, verifySpend, type SpentCoin } from '../../shared/vm.js';

// The deployed redeem script (see token-burner/README.md) and its P2SH32 lock.
const REDEEM_SCRIPT = hexToBin('c4519d00d10088016a00cd517f7587');
const BURNER_LOCK = new Uint8Array([0xaa, 0x20, ...hash256(REDEEM_SCRIPT), 0x87]);
const UNLOCK = encodeDataPush(REDEEM_SCRIPT);

const CATEGORY = new Uint8Array(32).fill(0xab);
const OTHER_CATEGORY = new Uint8Array(32).fill(0xcd);

function burnerCoin(token: Output['token'], valueSatoshis = 1000n): SpentCoin {
    return { lockingBytecode: BURNER_LOCK, unlockingBytecode: UNLOCK, valueSatoshis, token };
}

const fungibleCoin = burnerCoin({ category: CATEGORY, amount: 1_000_000n });
const nftCoin = burnerCoin({ category: OTHER_CATEGORY, amount: 0n, nft: { capability: 'none', commitment: utf8ToBin('#42') } });
// A rejection by the contract itself (input 0 is the burner coin), not by a standardness or consensus rule.
const CONTRACT_REJECTED = /error in evaluating input index 0/;

const farewell = (message: string): Output => ({ lockingBytecode: new Uint8Array([0x6a, ...encodeDataPush(utf8ToBin(message))]), valueSatoshis: 0n });

describe('TokenBurner contract (burner.cash)', () => {
    describe('accepts', () => {
        it('burning fungible tokens with a farewell message', () => {
            expect(verifySpend([fungibleCoin], [farewell('goodbye, tokens')])).toBe(true);
        });

        it('burning with a bare OP_RETURN and no message', () => {
            expect(verifySpend([fungibleCoin], [{ lockingBytecode: new Uint8Array([0x6a]), valueSatoshis: 0n }])).toBe(true);
        });

        it('burning an NFT', () => {
            expect(verifySpend([nftCoin], [farewell('farewell, #42')])).toBe(true);
        });

        it('burning several burner coins in one transaction', () => {
            expect(verifySpend([fungibleCoin, nftCoin, burnerCoin(undefined, 5000n)], [farewell('all of it')])).toBe(true);
        });
    });

    describe('rejects', () => {
        it('an extra change output (the burner cannot keep the satoshis)', () => {
            expect(verifySpend([fungibleCoin], [farewell('bye'), { lockingBytecode: ANYONE_CAN_SPEND, valueSatoshis: 500n }])).toMatch(CONTRACT_REJECTED);
        });

        it('a single P2PKH output that takes the satoshis', () => {
            expect(verifySpend([fungibleCoin], [{ lockingBytecode: p2pkhLockingBytecode(testKey(9).publicKeyHash), valueSatoshis: 800n }])).toMatch(CONTRACT_REJECTED);
        });

        it('an OP_RETURN output that still carries the tokens', () => {
            expect(verifySpend([fungibleCoin], [{ ...farewell('nope'), valueSatoshis: 800n, token: { category: CATEGORY, amount: 1_000_000n } }])).toMatch(CONTRACT_REJECTED);
        });

        it('an output whose first byte is not OP_RETURN', () => {
            expect(verifySpend([fungibleCoin], [{ lockingBytecode: new Uint8Array([0x51, 0x6a]), valueSatoshis: 800n }])).toMatch(CONTRACT_REJECTED);
        });

        it('a burn with zero outputs (what the upstream frontend builds when no message is given)', () => {
            // Consensus rejects it before the contract runs, so a burn needs at least a bare OP_RETURN output.
            expect(verifySpend([fungibleCoin], [])).toMatch(/at least one output/);
        });
    });
});
