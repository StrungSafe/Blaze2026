import {
    binToHex,
    createVirtualMachineBch2026,
    decodeTransaction,
    encodeLockingBytecodeP2pkh,
    encodeTransaction,
    hash160,
    hash256,
    hexToBin,
    lockingBytecodeToCashAddress,
    sha256,
    type Output,
    type TransactionCommon,
} from '@bitauth/libauth';

/**
 * Mainnet spend probe. Spends ONE of the wallet's own plain coins back to the same address, paying a fixed fee.
 * The only money that can leave the wallet is the fee. The signing wallet is asked with broadcast false; the page
 * verifies the returned signature itself and broadcasts only after a separate, deliberate click.
 */
export const FEE_SATOSHIS = 250n;
export const DUST_SATOSHIS = 546n;
/** The coin must leave at least this much after the fee. */
export const MINIMUM_COIN_SATOSHIS = FEE_SATOSHIS + DUST_SATOSHIS;

export interface Coin {
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
    /** WizardConnect path name ("receive" or "change") and the address index within it. */
    pathName: string;
    childIndex: number;
    addressIndex: number;
    publicKey: Uint8Array;
}

export const lockingBytecodeFor = (publicKey: Uint8Array): Uint8Array => encodeLockingBytecodeP2pkh(hash160(publicKey));

/** The Electrum script hash of a locking bytecode: SHA-256, byte-reversed, as hex. */
export const electrumScriptHash = (lockingBytecode: Uint8Array): string => binToHex(sha256.hash(lockingBytecode).reverse());

export function addressFor(publicKey: Uint8Array): string {
    const result = lockingBytecodeToCashAddress({ bytecode: lockingBytecodeFor(publicKey), prefix: 'bitcoincash' });

    if (typeof result === 'string') {
        throw new Error(result);
    }

    return result.address;
}

/** The unsigned spend: one input (the coin), one output back to the same key, minus the fixed fee. */
export function buildSpend(coin: Coin): { transaction: TransactionCommon; sourceOutput: Output } {
    if (coin.valueSatoshis < MINIMUM_COIN_SATOSHIS) {
        throw new Error(`Coin is too small: ${coin.valueSatoshis} sats, need at least ${MINIMUM_COIN_SATOSHIS}.`);
    }

    const lockingBytecode = lockingBytecodeFor(coin.publicKey);

    return {
        transaction: {
            version: 2,
            locktime: 0,
            inputs: [{ outpointTransactionHash: hexToBin(coin.transactionHash), outpointIndex: coin.outputIndex, sequenceNumber: 0xfffffffe, unlockingBytecode: new Uint8Array() }],
            outputs: [{ lockingBytecode, valueSatoshis: coin.valueSatoshis - FEE_SATOSHIS }],
        },
        sourceOutput: { lockingBytecode, valueSatoshis: coin.valueSatoshis },
    };
}

/** The signTransaction request body, in the relay-safe JSON form (see server/src/auth/challenge-transaction.ts). */
export function buildSignRequest(coin: Coin) {
    const { transaction, sourceOutput } = buildSpend(coin);
    const input = transaction.inputs[0]!;

    return {
        transaction: binToHex(encodeTransaction(transaction)),
        sourceOutputs: [
            {
                outpointTransactionHash: binToHex(input.outpointTransactionHash),
                outpointIndex: input.outpointIndex,
                unlockingBytecode: '',
                sequenceNumber: input.sequenceNumber,
                valueSatoshis: `<bigint: ${sourceOutput.valueSatoshis}n>`,
                lockingBytecode: binToHex(sourceOutput.lockingBytecode),
            },
        ],
        broadcast: false,
        userPrompt: `XOGrid mainnet test: move ${coin.valueSatoshis} sats back to your own address. Only the ${FEE_SATOSHIS} sat network fee leaves your wallet.`,
    };
}

export interface SpendVerdict {
    valid: boolean;
    reason?: string;
    transactionHex?: string;
    transactionId?: string;
}

/**
 * Checks what the wallet sent back: the very transaction we asked for (same input, same single output, same
 * version and locktime), a signature the BCH virtual machine accepts, and nothing else.
 */
export function verifySignedSpend(coin: Coin, signedTransactionHex: string): SpendVerdict {
    if (!/^([0-9a-fA-F]{2}){1,100000}$/.test(signedTransactionHex)) {
        return { valid: false, reason: 'the wallet did not return transaction hex' };
    }

    const decoded = decodeTransaction(hexToBin(signedTransactionHex));

    if (typeof decoded === 'string') {
        return { valid: false, reason: `could not decode the signed transaction: ${decoded}` };
    }

    const { transaction: expected, sourceOutput } = buildSpend(coin);
    const input = decoded.inputs[0];
    const output = decoded.outputs[0];
    const expectedInput = expected.inputs[0]!;
    const expectedOutput = expected.outputs[0]!;

    if (decoded.version !== expected.version || decoded.locktime !== expected.locktime) {
        return { valid: false, reason: 'unexpected version or locktime' };
    }

    if (decoded.inputs.length !== 1 || decoded.outputs.length !== 1 || !input || !output) {
        return { valid: false, reason: 'the wallet changed the number of inputs or outputs' };
    }

    if (binToHex(input.outpointTransactionHash) !== binToHex(expectedInput.outpointTransactionHash) || input.outpointIndex !== expectedInput.outpointIndex || input.sequenceNumber !== expectedInput.sequenceNumber) {
        return { valid: false, reason: 'the wallet changed the input' };
    }

    if (binToHex(output.lockingBytecode) !== binToHex(expectedOutput.lockingBytecode) || output.valueSatoshis !== expectedOutput.valueSatoshis || output.token !== undefined) {
        return { valid: false, reason: 'the wallet changed the output' };
    }

    const vm = createVirtualMachineBch2026();
    const result = vm.verify({ sourceOutputs: [sourceOutput], transaction: decoded });

    if (result !== true) {
        return { valid: false, reason: `signature check failed: ${String(result)}` };
    }

    const bytes = encodeTransaction(decoded);

    return { valid: true, transactionHex: binToHex(bytes), transactionId: binToHex(hash256(bytes).reverse()) };
}
