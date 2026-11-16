/**
 * The Revenue Split XO template: it must build exactly the contract in RevenueSplit.cash, compute the same share
 * amounts, refuse to fund a split that could never be spent, and pass the registry's automated audit.
 */
import { binToHex, encodeDataPush } from '@bitauth/libauth';
import { Contract, MockNetworkProvider } from 'cashscript';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../../../server/src/audit/index.js';
import artifactJson from '../artifact/RevenueSplit.json' with { type: 'json' };
import { toArtifact } from '../../shared/cashscript.js';
import { revenueSplitTemplate } from '../template.js';
import {
    ANYONE_CAN_SPEND,
    compileLock,
    compileScript,
    compileValue,
    p2pkhLockingBytecode,
    testKey,
    verifySpend,
    type TemplateVariables,
} from '../../shared/vm.js';

const artifact = toArtifact(artifactJson);
const template = parseTemplate(JSON.stringify(revenueSplitTemplate, (_key, value) => (typeof value === 'bigint' ? `${value}n` : value)));
const artist = testKey(1);
const collaborator = testKey(2);
const platform = testKey(3);

function splitVariables(overrides: TemplateVariables = {}): TemplateVariables {
    return {
        artistPublicKeyHash: artist.publicKeyHashHex,
        collaboratorPublicKeyHash: collaborator.publicKeyHashHex,
        platformPublicKeyHash: platform.publicKeyHashHex,
        artistBasisPoints: 6000n,
        collaboratorBasisPoints: 2500n,
        splitSatoshis: 100_000n,
        ...overrides,
    };
}

function cashScriptContract(artistBasisPoints = 6000n, collaboratorBasisPoints = 2500n): Contract {
    return new Contract(
        artifact,
        [artist.publicKeyHash, collaborator.publicKeyHash, platform.publicKeyHash, artistBasisPoints, collaboratorBasisPoints],
        { provider: new MockNetworkProvider() },
    );
}

function outputValue(outputIdentifier: string, variables: TemplateVariables): bigint {
    return compileValue(template, String(template.outputs[outputIdentifier]?.valueSatoshis), variables);
}

describe('Revenue Split template', () => {
    it('parses, and has a stable canonical identifier', () => {
        const identifier = generateTemplateIdentifier(template);

        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(identifier);
    });

    it('builds exactly the CashScript contract: same redeem script and same P2SH32 locking bytecode', () => {
        for (const [artistBasisPoints, collaboratorBasisPoints] of [
            [6000n, 2500n],
            [0n, 0n],
            [10000n, 0n],
            [3333n, 3333n],
        ] as const) {
            const variables = splitVariables({ artistBasisPoints, collaboratorBasisPoints });
            const contract = cashScriptContract(artistBasisPoints, collaboratorBasisPoints);

            expect(binToHex(compileScript(template, 'revenueSplitRedeem', variables))).toBe(contract.bytecode);
            expect(binToHex(compileLock(template, 'revenueSplitLockingScript', variables))).toBe(contract.lockingBytecode);
        }
    });

    it('pays recipients to their P2PKH addresses', () => {
        expect(compileLock(template, 'artistLockingScript', splitVariables())).toEqual(p2pkhLockingBytecode(artist.publicKeyHash));
        expect(compileLock(template, 'collaboratorLockingScript', splitVariables())).toEqual(p2pkhLockingBytecode(collaborator.publicKeyHash));
        expect(compileLock(template, 'platformLockingScript', splitVariables())).toEqual(p2pkhLockingBytecode(platform.publicKeyHash));
    });

    it('computes the same share amounts as the contract, with the remainder going to the platform', () => {
        for (const splitSatoshis of [100_000n, 10_001n, 999_999n]) {
            const variables = splitVariables({ splitSatoshis });
            const artistAmount = (splitSatoshis * 6000n) / 10000n;
            const collaboratorAmount = (splitSatoshis * 2500n) / 10000n;

            expect(outputValue('artistShareOutput', variables)).toBe(artistAmount);
            expect(outputValue('collaboratorShareOutput', variables)).toBe(collaboratorAmount);
            expect(outputValue('platformShareOutput', variables)).toBe(splitSatoshis - artistAmount - collaboratorAmount);
        }
    });

    it('builds a payout the VM accepts, and the VM rejects a payout that shorts a recipient', () => {
        const variables = splitVariables({ splitSatoshis: 100_000n });
        const splitCoin = {
            lockingBytecode: compileLock(template, 'revenueSplitLockingScript', variables),
            // unlockPayout is empty, so a P2SH32 spend is just the redeem script push.
            unlockingBytecode: encodeDataPush(compileScript(template, 'revenueSplitRedeem', variables)),
            valueSatoshis: 100_000n,
        };
        const feeCoin = { lockingBytecode: ANYONE_CAN_SPEND, unlockingBytecode: new Uint8Array(), valueSatoshis: 5_000n };
        const shareOutputs = () => [
            { lockingBytecode: compileLock(template, 'artistLockingScript', variables), valueSatoshis: outputValue('artistShareOutput', variables) },
            {
                lockingBytecode: compileLock(template, 'collaboratorLockingScript', variables),
                valueSatoshis: outputValue('collaboratorShareOutput', variables),
            },
            { lockingBytecode: compileLock(template, 'platformLockingScript', variables), valueSatoshis: outputValue('platformShareOutput', variables) },
        ];
        const change = { lockingBytecode: ANYONE_CAN_SPEND, valueSatoshis: 4_000n };

        expect(compileScript(template, 'unlockPayout', variables)).toEqual(new Uint8Array());
        expect(verifySpend([splitCoin, feeCoin], [...shareOutputs(), change])).toBe(true);

        const shorted = shareOutputs();
        shorted[1] = { ...shorted[1], valueSatoshis: shorted[1].valueSatoshis - 1n };
        expect(verifySpend([splitCoin, feeCoin], [...shorted, change])).not.toBe(true);

        const reordered = shareOutputs();
        expect(verifySpend([splitCoin, feeCoin], [reordered[1], reordered[0], reordered[2], change])).not.toBe(true);
    });

    describe('funding guard (the splitOutput value expression)', () => {
        it('evaluates to the split amount for valid parameters', () => {
            expect(outputValue('splitOutput', splitVariables())).toBe(100_000n);
            expect(outputValue('splitOutput', splitVariables({ artistBasisPoints: 10000n, collaboratorBasisPoints: 0n }))).toBe(100_000n);
        });

        it.each([
            ['basis points summing to more than 10000', { artistBasisPoints: 6000n, collaboratorBasisPoints: 4001n }],
            ['a negative artist share', { artistBasisPoints: -1n }],
            ['a negative collaborator share', { collaboratorBasisPoints: -1n }],
            ['a 19-byte artist key hash', { artistPublicKeyHash: artist.publicKeyHashHex.slice(2) }],
            ['a 21-byte platform key hash', { platformPublicKeyHash: `${platform.publicKeyHashHex}00` }],
        ])('refuses to build the funding output for %s', (_label, overrides) => {
            expect(() => outputValue('splitOutput', splitVariables(overrides as TemplateVariables))).toThrow();
        });
    });

    it('ENGINE NOTE: value expressions see a bytes variable as the UTF-8 text of its hex (40 bytes for a key hash)', () => {
        // If this starts failing, the engine changed how it encodes bytes in value expressions. Re-check
        // checkKeyHashSize in template.ts and the "XO engine notes" in README.md.
        expect(compileValue(template, '$(<artistPublicKeyHash> OP_SIZE OP_NIP)', splitVariables())).toBe(40n);
        expect(compileScript(template, 'artistLockingBytecode', splitVariables())).toHaveLength(25);
    });

    it('passes every automated registry audit check with no failures', () => {
        const report = runAudit({ storedJson: serializeTemplate(template), storedIdentifier: generateTemplateIdentifier(template) });
        const failing = report.results.filter((result) => result.status === 'fail');

        expect(failing).toEqual([]);
        expect(report.results.find((result) => result.id === 'compile')?.status).toBe('pass');
    });
});
