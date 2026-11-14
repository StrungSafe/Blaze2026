import { readFileSync } from 'node:fs';
import { binToBase64, secp256k1 } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import { messageHash, recoverSigner, signMessage, verifySignedMessage } from '../src/auth/signed-message.js';

interface Vector {
    message: string;
    address: string;
    publicKeyHex: string;
    signature: string;
    messageHashBase64: string;
    recoveryId: number;
}

// Signed by mainnet-js 4.0.0-next.13 (SignedMessage.sign) and verified by mainnet-js itself before being saved.
const vectors = JSON.parse(readFileSync(new URL('./fixtures/signed-message-vectors.json', import.meta.url), 'utf8')) as Vector[];

describe('signed messages (interoperability with mainnet-js)', () => {
    it('computes the same message hash as mainnet-js', () => {
        for (const v of vectors) {
            expect(binToBase64(messageHash(v.message))).toBe(v.messageHashBase64);
        }
    });

    it('accepts every mainnet-js signature for its CashAddress', () => {
        for (const v of vectors) {
            expect(verifySignedMessage(v.message, v.signature, v.address)).toMatchObject({ valid: true, recoveredPublicKey: v.publicKeyHex });
        }
    });

    it('accepts the signer public key as the identity, and an address without a prefix', () => {
        const v = vectors[0]!;

        expect(verifySignedMessage(v.message, v.signature, v.publicKeyHex).valid).toBe(true);
        expect(verifySignedMessage(v.message, v.signature, v.publicKeyHex.toUpperCase()).valid).toBe(true);
        expect(verifySignedMessage(v.message, v.signature, v.address.split(':')[1]!).valid).toBe(true);
    });

    it('covers both recovery ids, test-network addresses, unicode, long and empty messages', () => {
        expect(new Set(vectors.map((v) => v.recoveryId)).size).toBeGreaterThan(1);
        expect(vectors.some((v) => v.address.startsWith('bchtest:'))).toBe(true);
        expect(vectors.some((v) => v.message.length === 300)).toBe(true);
        expect(vectors.some((v) => v.message === '')).toBe(true);
    });
});

describe('signed messages (rejections)', () => {
    const v = vectors[0]!;
    const other = vectors[2]!;

    it('rejects a changed message', () => {
        expect(verifySignedMessage(v.message + ' ', v.signature, v.address).valid).toBe(false);
    });

    it('rejects a signature made by a different key', () => {
        expect(verifySignedMessage(v.message, v.signature, other.address).valid).toBe(false);
        expect(verifySignedMessage(v.message, v.signature, other.publicKeyHex).valid).toBe(false);
    });

    it('rejects a replayed signature on a different challenge', () => {
        expect(verifySignedMessage('hub-login:other-nonce', v.signature, v.address).valid).toBe(false);
    });

    it('rejects malformed input without throwing', () => {
        for (const bad of ['', 'not base64!!', 'AAAA', binToBase64(new Uint8Array(65))]) {
            expect(verifySignedMessage(v.message, bad, v.address).valid).toBe(false);
        }

        expect(verifySignedMessage(v.message, v.signature, 'not-an-address').valid).toBe(false);
        expect(verifySignedMessage(v.message, v.signature, '').valid).toBe(false);
    });

    it('rejects uncompressed-key headers', () => {
        const bytes = Uint8Array.from(Buffer.from(v.signature, 'base64'));

        bytes[0] = 27 + v.recoveryId; // clears the "compressed" bit

        expect(recoverSigner(v.message, binToBase64(bytes))).toMatchObject({ valid: false, reason: expect.stringMatching(/uncompressed/) });
    });

    it('rejects a high-S or tampered signature body', () => {
        const bytes = Uint8Array.from(Buffer.from(v.signature, 'base64'));

        bytes[40] = bytes[40]! ^ 0xff;

        expect(verifySignedMessage(v.message, binToBase64(bytes), v.address).valid).toBe(false);
    });

    it('has libauth available for recovery (sanity check)', () => {
        expect(typeof secp256k1.recoverPublicKeyCompressed).toBe('function');
    });
});

describe('signing helper', () => {
    it('produces signatures the verifier accepts, for several keys and messages', () => {
        for (let i = 1; i <= 6; i++) {
            const privateKey = new Uint8Array(32).fill(i * 7);
            const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);
            const hex = Buffer.from(publicKey as Uint8Array).toString('hex');
            const message = `challenge ${i}: ${'y'.repeat(i * 60)}`;

            expect(verifySignedMessage(message, signMessage(message, privateKey), hex)).toMatchObject({ valid: true, recoveredPublicKey: hex });
        }
    });

    it('is deterministic for the same key and message', () => {
        const privateKey = new Uint8Array(32).fill(9);

        expect(signMessage('same', privateKey)).toBe(signMessage('same', privateKey));
    });
});
