/**
 * The Drip Mine XO template: it must build exactly the deployed Drip Mine contract (same redeem script, same address
 * as the drip-mine README and vox.cash/drip), compute the payout the way the contract does, build drips and
 * terminations the VM accepts, and pass the registry's automated audit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bigIntToVmNumber, binToHex, encodeDataPush, encodeTransactionBch, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { completeMergedInput } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { compileString } from 'cashc-0.9';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../../../server/src/audit/index.js';
import artifact from '../artifact/DripMine.json' with { type: 'json' };
import { dripMineTemplate } from '../template.js';
import { compileLock, compileScript, completeOutput, verifySpend } from '../../shared/vm.js';

// Published in the drip-mine README (commit 5893d50e) and derived by vox.cash/drip from packages/drip/src/template.v3.json.
const DEPLOYED_REDEEM_SCRIPT = '51b275c3519dc4519d02400202a400c0c67b527993a063c0c7c0cd88c0c60228119504c685744f966ea063787768c0c6c0cc946ea2696d67c0cc009dc0cd016a88687551';
const DEPLOYED_LOCK = 'aa20a1c3a6a95ce1c4726221dc3e5f9d231611176b39f3c731cb0d24c650ee9b4b4c87';
const MAINNET_ADDRESS = 'bitcoincash:pwsu8f4ftnsugunzy8wruhuayvtpz9mt88euwvwtp5jvv58wnd95c0td3wpdp';
const CHIPNET_ADDRESS = 'bchtest:pwsu8f4ftnsugunzy8wruhuayvtpz9mt88euwvwtp5jvv58wnd95cvvu0kjcn';

// Parse the object directly: a JSON round trip of our own would turn bigints into plain strings.
const template = parseTemplate(dripMineTemplate as Parameters<typeof parseTemplate>[0]);
const lock = compileLock(template, 'dripMineLockingScript', {});
const unlock = encodeDataPush(compileScript(template, 'dripMineBytecode', {}));

function address(prefix: 'bitcoincash' | 'bchtest'): string {
    const result = lockingBytecodeToCashAddress({ bytecode: lock, prefix });

    if (typeof result === 'string') {
        throw new Error(result);
    }

    return result.address;
}

/** The output the engine builds for the drip action, spent from a coin of `coinValue` and checked in the VM. */
function dripFromTemplate(coinValue: bigint): { remainder: bigint; verified: true | string } {
    const output = completeOutput(template, 'drip', 'dripRemainderOutput', { dripCoinSatoshis: coinValue });
    const remainder = output.valueSatoshis as bigint;
    const verified = verifySpend(
        [{ lockingBytecode: lock, unlockingBytecode: unlock, valueSatoshis: coinValue, sequenceNumber: 1 }],
        [{ lockingBytecode: output.lockingBytecode as Uint8Array, valueSatoshis: remainder }],
    );

    return { remainder, verified };
}

describe('Drip Mine template', () => {
    it('parses, and has a stable canonical identifier', () => {
        const identifier = generateTemplateIdentifier(template);

        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(identifier);
    });

    it('rebuilding drip-mine.cash with cashc 0.9.3 reproduces the committed artifact', () => {
        const rebuilt = compileString(readFileSync(join(import.meta.dirname, '..', 'drip-mine.cash'), 'utf8').replaceAll('\r\n', '\n'));

        expect(rebuilt.bytecode).toBe(artifact.bytecode);
        expect(rebuilt.compiler.version).toBe('0.9.3');
    });

    it('builds exactly the deployed contract: same redeem script, lock and published addresses', () => {
        expect(binToHex(compileScript(template, 'dripMineBytecode', {}))).toBe(DEPLOYED_REDEEM_SCRIPT);
        expect(binToHex(lock)).toBe(DEPLOYED_LOCK);
        expect(address('bitcoincash')).toBe(MAINNET_ADDRESS);
        expect(address('bchtest')).toBe(CHIPNET_ADDRESS);
    });

    it('its constants are the numbers the redeem script embeds', () => {
        const constants = Object.fromEntries(Object.entries(template.constants ?? {}).map(([name, constant]) => [name, BigInt(constant.value as bigint)]));
        const pushes = artifact.bytecode.split(' ');

        expect(constants).toEqual({ dustLimit: 576n, minPayout: 164n, decayNumerator: 4392n, decayDenominator: 1333036486n });

        for (const value of Object.values(constants)) {
            expect(pushes).toContain(binToHex(bigIntToVmNumber(value)));
        }
    });

    it('resolves a funding output to the Drip Mine address, and refuses one below the dust limit', () => {
        const output = completeOutput(template, 'fund', 'fundingOutput', { fundSatoshis: 100_000n });

        expect(output.valueSatoshis).toBe(100_000n);
        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe(DEPLOYED_LOCK);
        expect(output.token).toBeUndefined();
        expect(() => completeOutput(template, 'fund', 'fundingOutput', { fundSatoshis: 575n })).toThrow();
    });

    it('takes the largest payout the contract allows, and the VM accepts every drip it builds', () => {
        const cases: Array<[bigint, bigint]> = [
            [741n, 164n],
            [50_000n, 164n],
            [100_000_000n, 329n],
            [99_971_669_342n, 329_380n],
        ];

        for (const [coinValue, payout] of cases) {
            const { remainder, verified } = dripFromTemplate(coinValue);

            expect(coinValue - remainder).toBe(payout);
            expect(verified).toBe(true);
            // One more satoshi of payout is over the limit, so the template leaves nothing on the table.
            expect(
                verifySpend([{ lockingBytecode: lock, unlockingBytecode: unlock, valueSatoshis: coinValue, sequenceNumber: 1 }], [{ lockingBytecode: lock, valueSatoshis: remainder - 1n }]),
            ).not.toBe(true);
        }
    });

    it('refuses to build a drip from a coin that must terminate, and a termination of a coin that must drip', () => {
        expect(() => completeOutput(template, 'drip', 'dripRemainderOutput', { dripCoinSatoshis: 740n })).toThrow();
        expect(() => completeOutput(template, 'terminate', 'terminalOutput', { dripCoinSatoshis: 741n })).toThrow();
    });

    it('builds a termination the VM accepts: a bare OP_RETURN with 0 sats', () => {
        const output = completeOutput(template, 'terminate', 'terminalOutput', { dripCoinSatoshis: 740n });

        expect(output.valueSatoshis).toBe(0n);
        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe('6a');
        expect(
            verifySpend([{ lockingBytecode: lock, unlockingBytecode: unlock, valueSatoshis: 740n, sequenceNumber: 1 }], [{ lockingBytecode: output.lockingBytecode as Uint8Array, valueSatoshis: 0n }]),
        ).toBe(true);
    });

    it('gives the engine sequence number 1 for a Drip Mine input, in both spends', () => {
        for (const action of ['drip', 'terminate']) {
            const input = completeMergedInput(
                { inputIdentifier: 'dripMineInput', outpointTransactionHash: new Uint8Array(32), outpointIndex: 0 } as never,
                template as never,
                action,
                [{ variableIdentifier: 'dripCoinSatoshis', value: 100_000n }] as never,
            );

            expect(input.sequenceNumber).toBe(1);
        }
    });

    it('a drip is 164 bytes, so the minimum payout is exactly 1 sat/byte', () => {
        const encoded = encodeTransactionBch({
            version: 2,
            locktime: 0,
            inputs: [{ outpointTransactionHash: new Uint8Array(32), outpointIndex: 0, sequenceNumber: 1, unlockingBytecode: unlock }],
            outputs: [{ lockingBytecode: lock, valueSatoshis: 100_000n }],
        });

        expect(encoded.length).toBe(164);
    });

    it('offers funding, dripping and terminating as start actions', () => {
        expect(template.start.map((entry) => `${entry.action}/${entry.role}`)).toEqual(['fund/funder', 'drip/dripper', 'terminate/dripper']);
    });

    it('committed template.json is current, with bigints in XO extended-JSON form', () => {
        const committed = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');

        expect(committed).toBe(serializeTemplate(template));
        expect(committed).not.toMatch(/"-?\d+n"/);
    });

    it('passes every automated registry audit check with no failures', () => {
        const report = runAudit({ storedJson: serializeTemplate(template), storedIdentifier: generateTemplateIdentifier(template) });
        const failing = report.results.filter((result) => result.status === 'fail');

        expect(failing).toEqual([]);
        expect(report.results.find((result) => result.id === 'compile')?.status).toBe('pass');
    });
});
