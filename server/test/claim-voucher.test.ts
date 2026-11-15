import { binToHex, createVirtualMachineBch2026, encodeDataPush, flattenBinArray, hash256, sha256, type Output } from '@bitauth/libauth';
import { compileLockingBytecodeFromTemplateLockingScriptIdentifier } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../src/audit/index.js';
import { claimVoucherTemplate } from '../src/templates/claim-voucher.js';

const template = parseTemplate(JSON.stringify(claimVoucherTemplate));
const code = new TextEncoder().encode('blaze-demo-code-1');
const codeHash = sha256.hash(code);
const redeem = new Uint8Array([0xa8, 0x20, ...codeHash, 0x87]); // OP_SHA256 <codeHash> OP_EQUAL
const vm = createVirtualMachineBch2026();

function compileLock(value: unknown): Uint8Array {
    return compileLockingBytecodeFromTemplateLockingScriptIdentifier(template as never, 'voucherLockingScript', { codeHash: value } as never);
}

function trySpend(claim: Uint8Array, lockingBytecode: Uint8Array): boolean {
    const sourceOutputs: Output[] = [{ lockingBytecode, valueSatoshis: 10000n }];
    const transaction = {
        version: 2,
        locktime: 0,
        inputs: [
            {
                outpointTransactionHash: new Uint8Array(32).fill(1),
                outpointIndex: 0,
                sequenceNumber: 0xffffffff,
                unlockingBytecode: flattenBinArray([encodeDataPush(claim), encodeDataPush(redeem)]),
            },
        ],
        outputs: [{ lockingBytecode: new Uint8Array([0x76, 0xa9, 0x14, ...new Array<number>(20).fill(7), 0x88, 0xac]), valueSatoshis: 9500n }],
    };

    return vm.verify({ sourceOutputs, transaction }) === true;
}

describe('Claim-Code Voucher template', () => {
    it('has a stable canonical identifier', () => {
        const id = generateTemplateIdentifier(template);

        expect(id).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(id);
    });

    it('locks to P2SH32 of "OP_SHA256 <codeHash> OP_EQUAL" when the hash is passed as hex', () => {
        expect(binToHex(compileLock(binToHex(codeHash)))).toBe(binToHex(new Uint8Array([0xaa, 0x20, ...hash256(redeem), 0x87])));
    });

    it('HAZARD: raw bytes instead of hex compile to a different lock script, so callers must pass hex', () => {
        expect(binToHex(compileLock(codeHash))).not.toBe(binToHex(compileLock(binToHex(codeHash))));
    });

    it('is spendable with the right code and with nothing else', () => {
        const lock = compileLock(binToHex(codeHash));

        expect(trySpend(code, lock)).toBe(true);
        expect(trySpend(new TextEncoder().encode('blaze-demo-code-2'), lock)).toBe(false);
        expect(trySpend(new Uint8Array(0), lock)).toBe(false);
        expect(trySpend(codeHash, lock)).toBe(false);
    });

    it('passes every automatic audit check with no failures', () => {
        const report = runAudit({ storedJson: serializeTemplate(template), storedIdentifier: generateTemplateIdentifier(template) });
        const failing = report.results.filter((result) => result.status === 'fail');

        expect(failing).toEqual([]);
        expect(report.results.find((result) => result.id === 'compile')?.status).toBe('pass');
    });
});
