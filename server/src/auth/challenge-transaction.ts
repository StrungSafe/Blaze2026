import {
    CashAddressType,
    binToHex,
    createVirtualMachineBch2026,
    decodeAuthenticationInstructions,
    decodeCashAddress,
    decodeHdPublicKey,
    decodeTransaction,
    deriveHdPublicNodeChild,
    encodeDataPush,
    encodeLockingBytecodeP2pkh,
    encodeTransaction,
    generateTransaction,
    hash160,
    hash256,
    hexToBin,
    secp256k1,
    utf8ToBin,
    walletTemplateP2pkhNonHd,
    walletTemplateToCompilerBch,
    type InputTemplate,
    type Output,
    type TransactionCommon,
} from '@bitauth/libauth';

/**
 * Wallet login by signing a challenge transaction (the idea behind BIP-322), for wallets that can sign
 * transactions but not messages. WizardConnect is one: it defines transaction signing only.
 *
 * The challenge transaction spends a made-up outpoint that cannot exist on chain, and its only output is an
 * OP_RETURN carrying the login nonce. It must be requested with broadcast = false. The hub rebuilds everything
 * except the unlocking script itself, checks the signature with a BCH virtual machine, and then checks that the
 * signing key belongs to an allowlisted moderator.
 */

export const LOGIN_DOMAIN = 'XO Template Hub login';

/** Value of the made-up input. It exists only so the wallet has a source output to sign against. */
export const CHALLENGE_SOURCE_SATOSHIS = 1000n;

/** Highest address index tried when matching a key against an extended public key. */
export const XPUB_SEARCH_LIMIT = 50;

/** A fake transaction hash derived from the nonce. Nobody has a transaction with this hash, so it can never confirm. */
export function challengeOutpointHash(nonce: string): Uint8Array {
    return hash256(utf8ToBin(`${LOGIN_DOMAIN}\n${nonce}`));
}

function challengeOutput(nonce: string): Output {
    const text = utf8ToBin(`${LOGIN_DOMAIN}:${nonce}`);

    return { lockingBytecode: Uint8Array.from([0x6a, ...encodeDataPush(text)]), valueSatoshis: 0n };
}

export interface ChallengeTransaction {
    /** Unsigned transaction: the input has an empty unlocking script. Send this to the wallet. */
    transaction: TransactionCommon;
    /** The source output the wallet needs in order to sign. */
    sourceOutputs: Output[];
}

/** Builds the unsigned challenge transaction for a nonce and the public key the wallet will sign with. */
export function buildChallengeTransaction(nonce: string, publicKey: Uint8Array): ChallengeTransaction {
    return {
        transaction: {
            version: 2,
            locktime: 0,
            inputs: [{ outpointTransactionHash: challengeOutpointHash(nonce), outpointIndex: 0, sequenceNumber: 0, unlockingBytecode: new Uint8Array() }],
            outputs: [challengeOutput(nonce)],
        },
        sourceOutputs: [{ lockingBytecode: encodeLockingBytecodeP2pkh(hash160(publicKey)), valueSatoshis: CHALLENGE_SOURCE_SATOSHIS }],
    };
}

export interface ChallengeVerification {
    valid: boolean;
    /** Why it failed, for logs. Never shown to the person logging in. */
    reason?: string;
    /** Compressed public key that signed the challenge, as hex. */
    publicKey?: string;
}

const bytesEqual = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);

/**
 * Verifies a signed challenge transaction (hex) for the given nonce. Returns the signing public key when the
 * transaction is exactly the expected challenge and its signature is valid. The caller must still check that the key
 * is allowed, and must make each nonce usable once.
 */
export function verifyChallengeTransaction(nonce: string, signedTransactionHex: string): ChallengeVerification {
    if (!/^([0-9a-fA-F]{2}){1,20000}$/.test(signedTransactionHex)) {
        return { valid: false, reason: 'transaction is not hex of a reasonable size' };
    }

    const transaction = decodeTransaction(hexToBin(signedTransactionHex));

    if (typeof transaction === 'string') {
        return { valid: false, reason: `transaction could not be decoded: ${transaction}` };
    }

    const expected = buildChallengeTransaction(nonce, new Uint8Array(33)).transaction;
    const input = transaction.inputs[0];
    const output = transaction.outputs[0];

    if (transaction.version !== expected.version || transaction.locktime !== expected.locktime) {
        return { valid: false, reason: 'unexpected version or locktime' };
    }

    if (transaction.inputs.length !== 1 || transaction.outputs.length !== 1 || !input || !output) {
        return { valid: false, reason: 'must have exactly one input and one output' };
    }

    const expectedInput = expected.inputs[0]!;

    if (
        !bytesEqual(input.outpointTransactionHash, expectedInput.outpointTransactionHash) ||
        input.outpointIndex !== expectedInput.outpointIndex ||
        input.sequenceNumber !== expectedInput.sequenceNumber
    ) {
        return { valid: false, reason: 'input does not match the challenge for this nonce' };
    }

    const expectedOutput = expected.outputs[0]!;

    if (output.valueSatoshis !== expectedOutput.valueSatoshis || !bytesEqual(output.lockingBytecode, expectedOutput.lockingBytecode) || output.token) {
        return { valid: false, reason: 'output does not match the challenge for this nonce' };
    }

    const publicKey = extractPublicKey(input.unlockingBytecode);

    if (!publicKey) {
        return { valid: false, reason: 'unlocking script is not a P2PKH signature and compressed public key' };
    }

    const sourceOutputs: Output[] = [
        { lockingBytecode: encodeLockingBytecodeP2pkh(hash160(publicKey)), valueSatoshis: CHALLENGE_SOURCE_SATOSHIS },
    ];
    const result = createVirtualMachineBch2026().verify({ sourceOutputs, transaction });

    if (typeof result === 'string') {
        return { valid: false, reason: `signature check failed: ${result}` };
    }

    return { valid: true, publicKey: binToHex(publicKey) };
}

/** Reads <signature> <compressed public key> from a standard P2PKH unlocking script, or returns undefined. */
function extractPublicKey(unlockingBytecode: Uint8Array): Uint8Array | undefined {
    const instructions = decodeAuthenticationInstructions(unlockingBytecode);

    if (instructions.length !== 2) {
        return undefined;
    }

    const [signature, publicKey] = instructions as unknown as [{ data?: Uint8Array; malformed?: boolean }, { data?: Uint8Array; malformed?: boolean }];

    if (signature.malformed || publicKey.malformed || !signature.data || !publicKey.data) {
        return undefined;
    }

    // Compressed keys only; a 64-byte Schnorr or DER ECDSA signature plus a hash type byte are both fine for the VM.
    return publicKey.data.length === 33 && (publicKey.data[0] === 2 || publicKey.data[0] === 3) ? publicKey.data : undefined;
}

/**
 * True when the compressed public key (hex) belongs to the identity, which is one of:
 *  - a compressed public key in hex
 *  - a P2PKH CashAddress (bitcoincash: or bchtest:, prefix optional)
 *  - an extended public key (xpub / tpub): any of its first XPUB_SEARCH_LIMIT non-hardened child keys
 */
export function publicKeyMatchesIdentity(publicKeyHex: string, identity: string): boolean {
    const entry = identity.trim();
    const key = publicKeyHex.toLowerCase();

    if (/^(02|03)[0-9a-fA-F]{64}$/.test(entry)) {
        return entry.toLowerCase() === key;
    }

    if (/^[xt]pub/.test(entry)) {
        const decoded = decodeHdPublicKey(entry);

        if (typeof decoded === 'string') {
            return false;
        }

        for (let index = 0; index < XPUB_SEARCH_LIMIT; index++) {
            const child = deriveHdPublicNodeChild(decoded.node, index);

            if (typeof child !== 'string' && binToHex(child.publicKey) === key) {
                return true;
            }
        }

        return false;
    }

    const address = [entry, `bitcoincash:${entry}`, `bchtest:${entry}`]
        .map((candidate) => decodeCashAddress(candidate))
        .find((decoded) => typeof decoded !== 'string');

    if (!address || typeof address === 'string') {
        return false;
    }

    if (address.type !== CashAddressType.p2pkh && address.type !== CashAddressType.p2pkhWithTokens) {
        return false;
    }

    return binToHex(address.payload) === binToHex(hash160(hexToBin(key)));
}

/**
 * Signs the challenge transaction with a private key and returns the signed transaction hex. The hub never holds
 * keys; this exists for tests and admin tooling, standing in for the wallet.
 */
export function signChallengeTransaction(nonce: string, privateKey: Uint8Array, algorithm: 'schnorr' | 'ecdsa' = 'schnorr'): string {
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);

    if (typeof publicKey === 'string') {
        throw new Error(`invalid private key: ${publicKey}`);
    }

    const { transaction, sourceOutputs } = buildChallengeTransaction(nonce, publicKey);
    const template = {
        ...walletTemplateP2pkhNonHd,
        scripts: {
            ...walletTemplateP2pkhNonHd.scripts,
            unlock: {
                ...walletTemplateP2pkhNonHd.scripts.unlock,
                script: `<key.${algorithm}_signature.all_outputs>\n<key.public_key>`,
            },
        },
    };
    const compiler = walletTemplateToCompilerBch(template as never);
    const input = transaction.inputs[0]!;
    const inputTemplate: InputTemplate<typeof compiler> = {
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: input.sequenceNumber,
        unlockingBytecode: {
            compiler,
            data: { keys: { privateKeys: { key: privateKey } } },
            valueSatoshis: sourceOutputs[0]!.valueSatoshis,
            script: 'unlock',
        },
    };
    const generated = generateTransaction({
        inputs: [inputTemplate],
        locktime: transaction.locktime,
        outputs: transaction.outputs,
        version: transaction.version,
    });

    if (!generated.success) {
        throw new Error(`could not sign challenge transaction: ${JSON.stringify(generated.errors).slice(0, 300)}`);
    }

    return binToHex(encodeTransaction(generated.transaction));
}
