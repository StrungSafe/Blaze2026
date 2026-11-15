import { binToHex, decodeTransaction, generateTransaction, hexToBin, secp256k1, walletTemplateP2pkhNonHd, walletTemplateToCompilerBch, encodeTransaction, type InputTemplate } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { FEE_SATOSHIS, MINIMUM_COIN_SATOSHIS, addressFor, buildSignRequest, buildSpend, electrumScriptHash, lockingBytecodeFor, verifySignedSpend, type Coin } from '../../probe/src/spend-core.js';

const privateKey = hexToBin('11'.repeat(32));
const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
const coin: Coin = { transactionHash: 'ab'.repeat(32), outputIndex: 1, valueSatoshis: 3000n, pathName: 'receive', childIndex: 0, addressIndex: 0, publicKey };

/** Signs the probe's spend with a throwaway key, standing in for the wallet. */
function sign(forCoin: Coin, mutate?: (tx: ReturnType<typeof buildSpend>['transaction']) => void): string {
    const compiler = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd as never);
    const { transaction, sourceOutput } = buildSpend(forCoin);
    const input = transaction.inputs[0]!;
    const inputTemplate: InputTemplate<typeof compiler> = {
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: input.sequenceNumber,
        unlockingBytecode: { compiler, data: { keys: { privateKeys: { key: privateKey } } }, valueSatoshis: sourceOutput.valueSatoshis, script: 'unlock' },
    };
    const generated = generateTransaction({ inputs: [inputTemplate], locktime: transaction.locktime, outputs: transaction.outputs, version: transaction.version });

    if (!generated.success) {
        throw new Error(JSON.stringify(generated.errors));
    }

    if (mutate) {
        mutate(generated.transaction);
    }

    return binToHex(encodeTransaction(generated.transaction));
}

describe('mainnet spend probe', () => {
    it('builds a self-spend that costs exactly the fixed fee', () => {
        const { transaction, sourceOutput } = buildSpend(coin);

        expect(transaction.outputs).toHaveLength(1);
        expect(transaction.outputs[0]!.valueSatoshis).toBe(coin.valueSatoshis - FEE_SATOSHIS);
        expect(binToHex(transaction.outputs[0]!.lockingBytecode)).toBe(binToHex(sourceOutput.lockingBytecode));
        expect(binToHex(sourceOutput.lockingBytecode)).toBe(binToHex(lockingBytecodeFor(publicKey)));
    });

    it('can spend a 1000 sat coin: 750 sats come back, above the dust limit', () => {
        const small = { ...coin, valueSatoshis: 1000n };

        expect(buildSpend(small).transaction.outputs[0]!.valueSatoshis).toBe(750n);
        expect(verifySignedSpend(small, sign(small)).valid).toBe(true);
    });

    it('refuses a coin too small to survive the fee', () => {
        expect(() => buildSpend({ ...coin, valueSatoshis: MINIMUM_COIN_SATOSHIS - 1n })).toThrow(/too small/);
    });

    it('derives a bitcoincash: address and a 64-hex Electrum script hash', () => {
        expect(addressFor(publicKey)).toMatch(/^bitcoincash:q[a-z0-9]{41}$/);
        expect(electrumScriptHash(lockingBytecodeFor(publicKey))).toMatch(/^[0-9a-f]{64}$/);
    });

    it('sends the request in relay-safe JSON with broadcast off', () => {
        const request = buildSignRequest(coin);

        expect(request.broadcast).toBe(false);
        expect(request.sourceOutputs[0]!.valueSatoshis).toBe('<bigint: 3000n>');
        expect(JSON.parse(JSON.stringify(request))).toEqual(request);
        expect(decodeTransaction(hexToBin(request.transaction))).toMatchObject({ version: 2, locktime: 0 });
    });

    it('accepts a correctly signed spend and reports its transaction id', () => {
        const verdict = verifySignedSpend(coin, sign(coin));

        expect(verdict.valid).toBe(true);
        expect(verdict.transactionId).toMatch(/^[0-9a-f]{64}$/);
        expect(verdict.transactionHex).toBe(sign(coin));
    });

    it('rejects a wallet that redirects the output to another address', () => {
        const other = hexToBin('22'.repeat(32));
        const otherKey = secp256k1.derivePublicKeyCompressed(other) as Uint8Array;
        const hex = sign(coin, (tx) => {
            tx.outputs[0]!.lockingBytecode = lockingBytecodeFor(otherKey);
        });

        expect(verifySignedSpend(coin, hex)).toMatchObject({ valid: false, reason: expect.stringMatching(/changed the output/) });
    });

    it('rejects a wallet that takes a bigger fee', () => {
        const hex = sign(coin, (tx) => {
            tx.outputs[0]!.valueSatoshis = coin.valueSatoshis - FEE_SATOSHIS - 1000n;
        });

        expect(verifySignedSpend(coin, hex)).toMatchObject({ valid: false, reason: expect.stringMatching(/changed the output/) });
    });

    it('rejects an extra output', () => {
        const hex = sign(coin, (tx) => {
            tx.outputs.push({ lockingBytecode: lockingBytecodeFor(publicKey), valueSatoshis: 546n });
        });

        expect(verifySignedSpend(coin, hex)).toMatchObject({ valid: false, reason: expect.stringMatching(/number of inputs or outputs/) });
    });

    it('rejects a signature made over a different coin value', () => {
        const hex = sign({ ...coin, valueSatoshis: 4000n }, (tx) => {
            tx.outputs[0]!.valueSatoshis = coin.valueSatoshis - FEE_SATOSHIS;
        });

        expect(verifySignedSpend(coin, hex)).toMatchObject({ valid: false, reason: expect.stringMatching(/signature check failed/) });
    });

    it('rejects text that is not transaction hex', () => {
        expect(verifySignedSpend(coin, 'not hex')).toMatchObject({ valid: false });
        expect(verifySignedSpend(coin, '')).toMatchObject({ valid: false });
    });
});
