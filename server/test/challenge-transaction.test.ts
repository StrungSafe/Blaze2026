import {
    binToHex,
    decodeAuthenticationInstructions,
    decodeTransaction,
    encodeDataPush,
    deriveHdPath,
    deriveHdPrivateNodeFromSeed,
    deriveHdPublicNode,
    encodeHdPublicKey,
    encodeTransaction,
    hexToBin,
    publicKeyToP2pkhCashAddress,
    secp256k1,
} from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
    buildChallengeTransaction,
    publicKeyMatchesIdentity,
    signChallengeTransaction,
    verifyChallengeTransaction,
} from '../src/auth/challenge-transaction.js';

const privateKey = new Uint8Array(32).fill(5);
const publicKeyHex = binToHex(secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array);
const nonce = '9f2c1a7e44b0d1e85a3b6c7d8e9f0a1b';

/** Decodes a signed challenge, rewrites the <signature> <public key> unlocking script, and re-encodes it. */
function rewriteUnlocking(hex: string, change: (signature: Uint8Array, publicKey: Uint8Array) => [Uint8Array, Uint8Array]): string {
    const decoded = decodeTransaction(hexToBin(hex));

    if (typeof decoded === 'string') {
        throw new Error(decoded);
    }

    const [signature, publicKey] = decodeAuthenticationInstructions(decoded.inputs[0]!.unlockingBytecode) as unknown as { data: Uint8Array }[];
    const [newSignature, newPublicKey] = change(signature!.data, publicKey!.data);
    const unlockingBytecode = Uint8Array.from([...encodeDataPush(newSignature), ...encodeDataPush(newPublicKey)]);

    return binToHex(encodeTransaction({ ...decoded, inputs: [{ ...decoded.inputs[0]!, unlockingBytecode }] }));
}

describe('challenge transaction login', () => {
    it('accepts a valid Schnorr-signed challenge and reports the signing key', () => {
        expect(verifyChallengeTransaction(nonce, signChallengeTransaction(nonce, privateKey, 'schnorr'))).toEqual({ valid: true, publicKey: publicKeyHex });
    });

    it('accepts a valid ECDSA-signed challenge', () => {
        expect(verifyChallengeTransaction(nonce, signChallengeTransaction(nonce, privateKey, 'ecdsa'))).toEqual({ valid: true, publicKey: publicKeyHex });
    });

    it('builds an unspendable challenge: made-up outpoint, OP_RETURN output, fixed source value', () => {
        const { transaction, sourceOutputs } = buildChallengeTransaction(nonce, hexToBin(publicKeyHex));

        expect(transaction.inputs).toHaveLength(1);
        expect(transaction.outputs).toHaveLength(1);
        expect(transaction.outputs[0]!.lockingBytecode[0]).toBe(0x6a);
        expect(transaction.outputs[0]!.valueSatoshis).toBe(0n);
        expect(sourceOutputs[0]!.valueSatoshis).toBe(1000n);
        // Different nonces never share an outpoint, so a signature cannot be replayed across challenges.
        expect(binToHex(buildChallengeTransaction('other', hexToBin(publicKeyHex)).transaction.inputs[0]!.outpointTransactionHash)).not.toBe(
            binToHex(transaction.inputs[0]!.outpointTransactionHash),
        );
    });

    it('rejects a signature for a different nonce (replay)', () => {
        const signed = signChallengeTransaction('old-nonce', privateKey);

        expect(verifyChallengeTransaction(nonce, signed)).toMatchObject({ valid: false, reason: expect.stringMatching(/does not match the challenge/) });
    });

    it('rejects a tampered output, an extra output and a changed amount', () => {
        const decoded = decodeTransaction(hexToBin(signChallengeTransaction(nonce, privateKey)));

        if (typeof decoded === 'string') {
            throw new Error(decoded);
        }

        const withOutput = { ...decoded, outputs: [...decoded.outputs, { lockingBytecode: decoded.outputs[0]!.lockingBytecode, valueSatoshis: 0n }] };
        const changedValue = { ...decoded, outputs: [{ ...decoded.outputs[0]!, valueSatoshis: 546n }] };
        const changedScript = {
            ...decoded,
            outputs: [{ ...decoded.outputs[0]!, lockingBytecode: Uint8Array.from([0x6a, 0x01, 0x41]) }],
        };

        for (const bad of [withOutput, changedValue, changedScript]) {
            expect(verifyChallengeTransaction(nonce, binToHex(encodeTransaction(bad))).valid).toBe(false);
        }
    });

    it('rejects a transaction whose signature bytes were altered', () => {
        const hex = signChallengeTransaction(nonce, privateKey, 'ecdsa');
        const bytes = hexToBin(hex);
        const position = bytes.length - 60;

        bytes[position] = bytes[position]! ^ 0xff;

        expect(verifyChallengeTransaction(nonce, binToHex(bytes)).valid).toBe(false);
    });

    it('rejects a signature byte that was flipped inside the unlocking script', () => {
        for (const algorithm of ['schnorr', 'ecdsa'] as const) {
            const tampered = rewriteUnlocking(signChallengeTransaction(nonce, privateKey, algorithm), (signature, publicKey) => {
                const copy = signature.slice();

                copy[10] = copy[10]! ^ 0x01;

                return [copy, publicKey];
            });

            expect(verifyChallengeTransaction(nonce, tampered)).toMatchObject({ valid: false, reason: expect.stringMatching(/signature check failed/) });
        }
    });

    it('rejects a signature made by one key presented with another key', () => {
        const otherKey = new Uint8Array(32).fill(9);
        const otherPublicKey = secp256k1.derivePublicKeyCompressed(otherKey) as Uint8Array;
        const swapped = rewriteUnlocking(signChallengeTransaction(nonce, otherKey), (signature) => [signature, hexToBin(publicKeyHex)]);

        expect(binToHex(otherPublicKey)).not.toBe(publicKeyHex);
        expect(verifyChallengeTransaction(nonce, swapped)).toMatchObject({ valid: false, reason: expect.stringMatching(/signature check failed/) });
    });

    it('rejects an unsigned challenge and malformed input without throwing', () => {
        const { transaction } = buildChallengeTransaction(nonce, hexToBin(publicKeyHex));

        expect(verifyChallengeTransaction(nonce, binToHex(encodeTransaction(transaction))).valid).toBe(false);

        for (const bad of ['', 'zz', 'abcd', 'f'.repeat(50), '00'.repeat(30000)]) {
            expect(verifyChallengeTransaction(nonce, bad).valid).toBe(false);
        }
    });

    it('verifies for any key, so the allowlist check is what keeps strangers out', () => {
        const stranger = new Uint8Array(32).fill(77);
        const result = verifyChallengeTransaction(nonce, signChallengeTransaction(nonce, stranger));

        expect(result.valid).toBe(true);
        expect(publicKeyMatchesIdentity(result.publicKey!, publicKeyHex)).toBe(false);
    });
});

describe('allowlist identity matching', () => {
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
    const address = (prefix: 'bitcoincash' | 'bchtest') => {
        const result = publicKeyToP2pkhCashAddress({ publicKey, prefix } as never) as unknown;

        return typeof result === 'string' ? result : (result as { address: string }).address;
    };

    it('matches a public key in hex, in either case', () => {
        expect(publicKeyMatchesIdentity(publicKeyHex, publicKeyHex)).toBe(true);
        expect(publicKeyMatchesIdentity(publicKeyHex, publicKeyHex.toUpperCase())).toBe(true);
        expect(publicKeyMatchesIdentity(publicKeyHex, '02' + '11'.repeat(32))).toBe(false);
    });

    it('matches a CashAddress with or without prefix, mainnet or chipnet', () => {
        const mainnet = address('bitcoincash');
        const chipnet = address('bchtest');

        expect(publicKeyMatchesIdentity(publicKeyHex, mainnet)).toBe(true);
        expect(publicKeyMatchesIdentity(publicKeyHex, mainnet.split(':')[1]!)).toBe(true);
        expect(publicKeyMatchesIdentity(publicKeyHex, chipnet)).toBe(true);
        expect(publicKeyMatchesIdentity(publicKeyHex, 'bitcoincash:qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq')).toBe(false);
        expect(publicKeyMatchesIdentity(publicKeyHex, 'garbage')).toBe(false);
        expect(publicKeyMatchesIdentity(publicKeyHex, '')).toBe(false);
    });

    it('matches keys derived from an extended public key, and rejects index 50 and other xpubs', () => {
        const root = deriveHdPrivateNodeFromSeed(new Uint8Array(32).fill(3));
        const account = deriveHdPath(root, "m/44'/145'/0'/0");

        if (typeof account === 'string') {
            throw new Error(account);
        }

        const xpub = encodeHdPublicKey({ network: 'mainnet', node: deriveHdPublicNode(account) }).hdPublicKey;
        const keyAt = (index: number) => {
            const child = deriveHdPath(root, `m/44'/145'/0'/0/${index}`);

            if (typeof child === 'string') {
                throw new Error(child);
            }

            return binToHex(secp256k1.derivePublicKeyCompressed(child.privateKey) as Uint8Array);
        };
        const other = deriveHdPath(deriveHdPrivateNodeFromSeed(new Uint8Array(32).fill(4)), "m/44'/145'/0'/0");
        const otherXpub = encodeHdPublicKey({ network: 'mainnet', node: deriveHdPublicNode(other as never) }).hdPublicKey;

        expect(publicKeyMatchesIdentity(keyAt(0), xpub)).toBe(true);
        expect(publicKeyMatchesIdentity(keyAt(7), xpub)).toBe(true);
        expect(publicKeyMatchesIdentity(keyAt(49), xpub)).toBe(true);
        expect(publicKeyMatchesIdentity(keyAt(50), xpub)).toBe(false);
        expect(publicKeyMatchesIdentity(keyAt(0), otherXpub)).toBe(false);
        expect(publicKeyMatchesIdentity(keyAt(0), 'xpub-not-valid')).toBe(false);
    });
});

describe('buildWalletSignRequest', () => {
    it('is relay-safe JSON: serialises without BigInt errors and round-trips to the challenge transaction', async () => {
        const { buildWalletSignRequest, buildChallengeTransaction } = await import('../src/auth/challenge-transaction.js');
        const { decodeTransaction, hexToBin } = await import('@bitauth/libauth');
        const publicKey = secp256k1.derivePublicKeyCompressed(new Uint8Array(32).fill(5)) as Uint8Array;
        const request = buildWalletSignRequest('abc123', publicKey);

        // This is what the relay does to the request. It threw "Do not know how to serialize a BigInt" before.
        const wire = JSON.parse(JSON.stringify(request));
        const source = wire.sourceOutputs[0];
        const expected = buildChallengeTransaction('abc123', publicKey);
        const decoded = decodeTransaction(hexToBin(wire.transaction));

        expect(wire.broadcast).toBe(false);
        expect(source.valueSatoshis).toBe('<bigint: 1000n>');
        expect(source.outpointTransactionHash).toMatch(/^[0-9a-f]{64}$/);
        expect(source.outpointIndex).toBe(0);
        expect(source.sequenceNumber).toBe(0);
        expect(typeof decoded).not.toBe('string');
        expect(decoded).toEqual(expected.transaction);
    });
});
