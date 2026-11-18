import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex } from '@bitauth/libauth';
import { deserializeInvitation } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import type { Network } from '../src/lib/invitation';
import {
    MAX_BURN_MESSAGE_BYTES,
    buildTokenBurnInvitation,
    farewellLockingBytecode,
    tokenBurnerAddress,
    tokenBurnerLockingBytecode,
    tokenBurnerTemplateIdentifier,
    type BurnerCoin,
} from '../src/lib/token-burner';

const CATEGORY = '0b7ed51a5de73071512ea4f17eeeb1f8a3d6796de3f5ce322e6da750820fe4b4';
const hash = (digit: string): string => digit.repeat(64);
const fungibleCoin: BurnerCoin = { transactionHash: hash('a'), outputIndex: 0, valueSatoshis: 1000n, token: { category: CATEGORY, amount: 250_000n } };
const nftCoin: BurnerCoin = {
    transactionHash: hash('b'),
    outputIndex: 1,
    valueSatoshis: 800n,
    token: { category: CATEGORY, amount: 0n, nft: { capability: 'mutable', commitment: 'cafe' } },
};
const bchCoin: BurnerCoin = { transactionHash: hash('c'), outputIndex: 2, valueSatoshis: 3000n };
const NETWORKS: Network[] = ['chipnet', 'mainnet'];

describe('Token Burner invitations (web tool)', () => {
    it('uses the committed Token Burner template and its live addresses', () => {
        const readme = readFileSync(join(import.meta.dirname, '..', '..', 'token-burner', 'README.md'), 'utf8');

        expect(readme).toContain(tokenBurnerTemplateIdentifier);
        expect(readme).toContain(tokenBurnerAddress('mainnet'));
        expect(readme).toContain(tokenBurnerAddress('chipnet'));
        expect(tokenBurnerAddress('mainnet')).toBe('bitcoincash:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlc2s5qtune');
    });

    it('builds the farewell OP_RETURN like the template', () => {
        expect(binToHex(farewellLockingBytecode(''))).toBe('6a00');
        expect(binToHex(farewellLockingBytecode('bye'))).toBe('6a03627965');
    });

    for (const network of NETWORKS) {
        it(`burns fungible tokens, an NFT and plain BCH in one invitation on ${network}`, () => {
            const result = buildTokenBurnInvitation(network, [fungibleCoin, nftCoin, bchCoin], 'Farewell from XOGrid');
            const { inputs, outputs } = result.transaction;

            expect(inputs).toHaveLength(3);
            expect(inputs.map((input) => binToHex(input.outpointTransactionHash))).toEqual([hash('a'), hash('b'), hash('c')]);
            expect(inputs.every((input) => input.unlockingBytecode.length > 0)).toBe(true);
            expect(outputs).toHaveLength(1);
            expect(outputs[0]!.valueSatoshis).toBe(0n);
            expect(outputs[0]!.token).toBeUndefined();
            expect(binToHex(outputs[0]!.lockingBytecode)).toBe(binToHex(farewellLockingBytecode('Farewell from XOGrid')));
            expect(result.feeSatoshis).toBe(4800n);
            expect(result.fungibleTokens).toEqual([{ category: CATEGORY, amount: 250_000n }]);
            expect(result.nftCount).toBe(1);
        });
    }

    it('accepts an empty farewell message and rejects one over the limit', () => {
        expect(binToHex(buildTokenBurnInvitation('chipnet', [bchCoin], '').transaction.outputs[0]!.lockingBytecode)).toBe('6a00');
        expect(() => buildTokenBurnInvitation('chipnet', [bchCoin], 'x'.repeat(MAX_BURN_MESSAGE_BYTES + 1))).toThrow(/limit is 219/);
        expect(buildTokenBurnInvitation('chipnet', [bchCoin], 'x'.repeat(MAX_BURN_MESSAGE_BYTES)).transaction.outputs).toHaveLength(1);
    });

    it('copies an invitation with every input, its tokens and its unlocking bytecode', () => {
        const result = buildTokenBurnInvitation('mainnet', [fungibleCoin, nftCoin], 'bye');
        const invitation = deserializeInvitation(result.serializedInvitation);
        const inputs = invitation.commits.flatMap((commit) => commit.data.inputs ?? []);
        const variables = invitation.commits.flatMap((commit) => commit.data.variables ?? []);

        expect(invitation.templateIdentifier).toBe(tokenBurnerTemplateIdentifier);
        expect(invitation.actionIdentifier).toBe('burn');
        expect(inputs.filter((input) => input.mergesWith !== undefined && input.unlockingBytecode !== undefined)).toHaveLength(2);
        expect(result.serializedInvitation).toContain(`"category":"<uint8array: ${CATEGORY}>"`);
        expect(variables).toEqual([{ variableIdentifier: 'burnMessage', value: 'bye', roleIdentifier: 'burner' }]);
        expect(binToHex(tokenBurnerLockingBytecode)).toMatch(/^aa20/);
    });

    it('rejects an empty selection, duplicates and malformed coins', () => {
        expect(() => buildTokenBurnInvitation('chipnet', [], '')).toThrow(/at least one/);
        expect(() => buildTokenBurnInvitation('chipnet', [bchCoin, { ...bchCoin }], '')).toThrow(/listed twice/);
        expect(() => buildTokenBurnInvitation('chipnet', [{ ...bchCoin, transactionHash: 'abc' }], '')).toThrow(/transaction id/);
    });
});
