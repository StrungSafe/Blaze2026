import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex } from '@bitauth/libauth';
import { deserializeInvitation as parseInvitation } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import {
    TERMINATE_AT_OR_BELOW,
    buildDripMineInvitation,
    dripMineAddress,
    dripMineLockingBytecode,
    dripMinePayout,
    dripMineTemplateIdentifier,
} from '../src/lib/drip-mine';
import type { Network } from '../src/lib/invitation';

const COIN_HASH = '100d9a91ce5bced2cdd3fa77f25e9b17b810bfac3dfbfcee0c512c7ad2cf98d9';
const NETWORKS: Network[] = ['chipnet', 'mainnet'];

describe('Drip Mine invitations (web tool)', () => {
    it('uses the committed Drip Mine template and its live address', () => {
        const readme = readFileSync(join(import.meta.dirname, '..', '..', 'drip-mine', 'README.md'), 'utf8');

        expect(readme).toContain(dripMineTemplateIdentifier);
        expect(binToHex(dripMineLockingBytecode)).toBe('aa20a1c3a6a95ce1c4726221dc3e5f9d231611176b39f3c731cb0d24c650ee9b4b4c87');
        expect(readme).toContain(dripMineAddress('mainnet'));
        expect(readme).toContain(dripMineAddress('chipnet'));
        expect(TERMINATE_AT_OR_BELOW).toBe(740n);
    });

    it('computes the payout from the template constants', () => {
        expect(dripMinePayout(672684n)).toBe(164n);
        expect(dripMinePayout(1_000_000_000n)).toBe((1_000_000_000n * 4392n) / 1333036486n);
        expect(dripMinePayout(740n)).toBe(740n);
        expect(dripMinePayout(741n)).toBe(164n);
    });

    for (const network of NETWORKS) {
        it(`builds a drip invitation on ${network} that XO validates and the VM accepts`, () => {
            const value = 1_000_000_000n;
            const result = buildDripMineInvitation(network, { transactionHash: COIN_HASH, outputIndex: 0, valueSatoshis: value });
            const [input] = result.transaction.inputs;
            const [output] = result.transaction.outputs;

            expect(result.action).toBe('drip');
            expect(result.transaction.inputs).toHaveLength(1);
            expect(result.transaction.outputs).toHaveLength(1);
            expect(binToHex(input!.outpointTransactionHash)).toBe(COIN_HASH);
            expect(input!.sequenceNumber).toBe(1);
            expect(input!.unlockingBytecode.length).toBeGreaterThan(0);
            expect(binToHex(output!.lockingBytecode)).toBe(binToHex(dripMineLockingBytecode));
            expect(output!.valueSatoshis).toBe(value - dripMinePayout(value));
            expect(result.payoutSatoshis + result.remainderSatoshis).toBe(value);
            expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());
        });

        it(`builds a terminate invitation on ${network} for a coin of 740 sats or less`, () => {
            const result = buildDripMineInvitation(network, { transactionHash: COIN_HASH, outputIndex: 3, valueSatoshis: 600n });
            const [output] = result.transaction.outputs;

            expect(result.action).toBe('terminate');
            expect(result.payoutSatoshis).toBe(600n);
            expect(output!.valueSatoshis).toBe(0n);
            expect(binToHex(output!.lockingBytecode)).toBe('6a');
        });
    }

    it('copies an invitation that parses back with the input, its unlocking bytecode and a fresh signer each time', () => {
        const coin = { transactionHash: COIN_HASH, outputIndex: 0, valueSatoshis: 672684n };
        const first = buildDripMineInvitation('mainnet', coin);
        const second = buildDripMineInvitation('mainnet', coin);
        const invitation = parseInvitation(first.serializedInvitation);
        const inputs = invitation.commits.flatMap((commit) => commit.data.inputs ?? []);

        expect(invitation.templateIdentifier).toBe(dripMineTemplateIdentifier);
        expect(invitation.actionIdentifier).toBe('drip');
        expect(inputs.some((input) => input.unlockingBytecode !== undefined && input.mergesWith !== undefined)).toBe(true);
        expect(first.serializedInvitation).toMatch(/"entityIdentifier":"xpub/);
        expect(buildDripMineInvitation('chipnet', coin).serializedInvitation).toMatch(/"entityIdentifier":"tpub/);
        expect(parseInvitation(second.serializedInvitation).commits[0]!.entityIdentifier).not.toBe(invitation.commits[0]!.entityIdentifier);
    });

    it('rejects a malformed coin', () => {
        expect(() => buildDripMineInvitation('chipnet', { transactionHash: 'abc', outputIndex: 0, valueSatoshis: 1000n })).toThrow(/transaction id/);
        expect(() => buildDripMineInvitation('chipnet', { transactionHash: COIN_HASH, outputIndex: 0, valueSatoshis: 0n })).toThrow(/positive/);
    });
});
