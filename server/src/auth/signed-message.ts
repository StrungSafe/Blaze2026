import {
    CashAddressType,
    base64ToBin,
    bigIntToCompactUint,
    binToBase64,
    binToHex,
    decodeCashAddress,
    flattenBinArray,
    hash160,
    hash256,
    secp256k1,
    utf8ToBin,
} from '@bitauth/libauth';

/**
 * Verifies "Bitcoin Signed Message" signatures, the format produced by mainnet-js (`SignedMessage.sign`), Electron
 * Cash and most BCH wallets: a 65-byte base64 string (header byte, then a 64-byte compact r||s) over
 * sha256d("\x18Bitcoin Signed Message:\n" + varint(length) + message).
 */

const MAGIC = utf8ToBin('\x18Bitcoin Signed Message:\n');

export interface VerifyResult {
    valid: boolean;
    /** Why verification failed, in words a log reader can use. Never shown to the person logging in. */
    reason?: string;
    /** Compressed public key recovered from the signature, as hex, when recovery succeeded. */
    recoveredPublicKey?: string;
}

/** The 32-byte hash that is actually signed. */
export function messageHash(message: string): Uint8Array {
    const body = utf8ToBin(message);

    return hash256(flattenBinArray([MAGIC, bigIntToCompactUint(BigInt(body.length)), body]));
}

/**
 * Signs a message with a 32-byte private key and returns the base64 signature. The hub itself only verifies; this is
 * for admin tooling and tests, so a moderator can answer a login challenge without a separate wallet app.
 */
export function signMessage(message: string, privateKey: Uint8Array): string {
    const signed = secp256k1.signMessageHashRecoverableCompact(privateKey, messageHash(message));

    if (typeof signed === 'string') {
        throw new Error(`could not sign message: ${signed}`);
    }

    // Header byte: 27 + recovery id, plus 4 for a compressed public key (the only kind the hub accepts).
    return binToBase64(Uint8Array.from([27 + signed.recoveryId + 4, ...signed.signature]));
}

/**
 * Recovers the signer's compressed public key from a signed message. Uncompressed-key signatures are rejected on
 * purpose: current wallets sign with compressed keys, and accepting one format keeps the check simple.
 */
export function recoverSigner(message: string, signatureBase64: string): VerifyResult {
    let signature: Uint8Array;

    try {
        signature = base64ToBin(signatureBase64);
    } catch {
        return { valid: false, reason: 'signature is not valid base64' };
    }

    if (typeof signature === 'string' || signature.length !== 65) {
        return { valid: false, reason: 'signature must be 65 bytes' };
    }

    const header = signature[0]!;

    if (header < 27 || header > 34) {
        return { valid: false, reason: 'unknown signature header' };
    }

    const recoveryId = (header - 27) & 3;
    const compressed = ((header - 27) & 4) !== 0;

    if (!compressed) {
        return { valid: false, reason: 'uncompressed-key signatures are not supported' };
    }

    const hash = messageHash(message);
    const compact = signature.slice(1);
    const publicKey = secp256k1.recoverPublicKeyCompressed(compact, recoveryId as 0 | 1 | 2 | 3, hash);

    if (typeof publicKey === 'string') {
        return { valid: false, reason: `public key recovery failed: ${publicKey}` };
    }

    // Recovery alone is not proof that the signature is valid for this hash, so check it explicitly too.
    if (!secp256k1.verifySignatureCompact(compact, publicKey, hash)) {
        return { valid: false, reason: 'signature does not match the message' };
    }

    return { valid: true, recoveredPublicKey: binToHex(publicKey) };
}

/**
 * True when `signatureBase64` is a valid signature of `message` by the owner of `identity`, which is either a P2PKH
 * CashAddress (bitcoincash: or bchtest:, with or without prefix) or a compressed public key in hex.
 */
export function verifySignedMessage(message: string, signatureBase64: string, identity: string): VerifyResult {
    const recovered = recoverSigner(message, signatureBase64);

    if (!recovered.valid || !recovered.recoveredPublicKey) {
        return recovered;
    }

    const trimmed = identity.trim();

    if (/^(02|03)[0-9a-fA-F]{64}$/.test(trimmed)) {
        return trimmed.toLowerCase() === recovered.recoveredPublicKey
            ? recovered
            : { valid: false, reason: 'signer does not match the public key' };
    }

    const decoded = decodeCashAddress(trimmed.includes(':') ? trimmed : `bitcoincash:${trimmed}`);

    if (typeof decoded === 'string') {
        // Retry as a test-network address when the caller passed one without a prefix.
        const retry = trimmed.includes(':') ? decoded : decodeCashAddress(`bchtest:${trimmed}`);

        if (typeof retry === 'string') {
            return { valid: false, reason: 'identity is not a valid CashAddress or public key' };
        }

        return matchAddress(retry, recovered);
    }

    return matchAddress(decoded, recovered);
}

function matchAddress(decoded: Exclude<ReturnType<typeof decodeCashAddress>, string>, recovered: VerifyResult): VerifyResult {
    if (decoded.type !== CashAddressType.p2pkh && decoded.type !== CashAddressType.p2pkhWithTokens) {
        return { valid: false, reason: 'only P2PKH addresses can sign messages' };
    }

    const publicKeyHash = binToHex(hash160(hexToBytes(recovered.recoveredPublicKey!)));

    return publicKeyHash === binToHex(decoded.payload)
        ? recovered
        : { valid: false, reason: 'signer does not match the address' };
}

function hexToBytes(hex: string): Uint8Array {
    return Uint8Array.from(hex.match(/../g)!.map((byte) => parseInt(byte, 16)));
}
