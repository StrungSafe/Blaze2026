import {
    binToHex,
    cashAddressToLockingBytecode,
    createVirtualMachineBch2026,
    decodeTransaction,
    encodeDataPush,
    encodeLockingBytecodeP2pkh,
    encodeLockingBytecodeP2sh32,
    encodeTransaction,
    flattenBinArray,
    hash160,
    hash256,
    hexToBin,
    lockingBytecodeToCashAddress,
    sha256,
    type Output,
    type TransactionCommon,
} from '@bitauth/libauth';

/**
 * The XOGrid claim-code voucher, built directly with libauth so it works in a browser wallet-connect flow.
 *
 * Lock:    P2SH32 of the redeem script  OP_SHA256 <sha256(code)> OP_EQUAL  (what the XO template compiles to)
 * Unlock:  <code> <redeem script>       (no signature, so anyone holding the code can claim)
 * Issue:   one wallet coin in, voucher output (index 0) plus change back to the same address.
 * Claim:   the voucher output in, one output to the claimer's address. Needs no wallet signature at all.
 */
export type Network = 'chipnet' | 'mainnet';

export interface NetworkConfig {
    label: string;
    prefix: 'bchtest' | 'bitcoincash';
    hosts: string[];
    realMoney: boolean;
}

export const NETWORKS: Record<Network, NetworkConfig> = {
    chipnet: { label: 'Chipnet (free test coins)', prefix: 'bchtest', hosts: ['chipnet.imaginary.cash', 'chipnet.bch.ninja'], realMoney: false },
    mainnet: { label: 'Mainnet (real BCH)', prefix: 'bitcoincash', hosts: ['bch.imaginary.cash', 'electrum.imaginary.cash', 'cashnode.bch.ninja', 'fulcrum.greyh.at'], realMoney: true },
};

export const VOUCHER_TEMPLATE_IDENTIFIER = '317c4947b5b9cc71d1fe01616cdc930b6ca3ef5808700c68d1cb0696e79b4911';
export const ISSUE_FEE_SATOSHIS = 400n;
export const CLAIM_FEE_SATOSHIS = 250n;
export const DUST_SATOSHIS = 546n;
export const MINIMUM_VOUCHER_SATOSHIS = 1000n;
export const CODE_BYTES = 16;

export interface Coin {
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
    /** WizardConnect path name and address index, so the wallet knows which key signs. */
    pathName: string;
    addressIndex: number;
    publicKey: Uint8Array;
}

export const newClaimCode = (): Uint8Array => crypto.getRandomValues(new Uint8Array(CODE_BYTES));
export const codeHash = (code: Uint8Array): Uint8Array => sha256.hash(code);

export function parseClaimCode(text: string): Uint8Array {
    const clean = text.trim().toLowerCase();

    if (!new RegExp(`^[0-9a-f]{${CODE_BYTES * 2}}$`).test(clean)) {
        throw new Error(`A claim code is ${CODE_BYTES * 2} hex characters.`);
    }

    return hexToBin(clean);
}

const OP_SHA256 = 0xa8;
const OP_EQUAL = 0x87;

/** OP_SHA256 <hash> OP_EQUAL */
export const redeemScript = (hash: Uint8Array): Uint8Array => flattenBinArray([Uint8Array.of(OP_SHA256), encodeDataPush(hash), Uint8Array.of(OP_EQUAL)]);
export const voucherLockingBytecode = (hash: Uint8Array): Uint8Array => encodeLockingBytecodeP2sh32(hash256(redeemScript(hash)));
export const voucherUnlockingBytecode = (code: Uint8Array): Uint8Array => flattenBinArray([encodeDataPush(code), encodeDataPush(redeemScript(codeHash(code)))]);

export const walletLockingBytecode = (publicKey: Uint8Array): Uint8Array => encodeLockingBytecodeP2pkh(hash160(publicKey));
/** The Electrum script hash of a locking bytecode: SHA-256, byte-reversed, as hex. */
export const electrumScriptHash = (lockingBytecode: Uint8Array): string => binToHex(sha256.hash(lockingBytecode).reverse());

export function addressFor(lockingBytecode: Uint8Array, network: Network): string {
    const result = lockingBytecodeToCashAddress({ bytecode: lockingBytecode, prefix: NETWORKS[network].prefix });

    if (typeof result === 'string') {
        throw new Error(result);
    }

    return result.address;
}

/** Parses a cash address for the given network; refuses an address from the other network. */
export function lockingBytecodeFromAddress(address: string, network: Network): Uint8Array {
    const trimmed = address.trim();
    const withPrefix = trimmed.includes(':') ? trimmed : `${NETWORKS[network].prefix}:${trimmed}`;

    if (!withPrefix.startsWith(`${NETWORKS[network].prefix}:`)) {
        throw new Error(`That address is not a ${network} address (it must start with ${NETWORKS[network].prefix}:).`);
    }

    const decoded = cashAddressToLockingBytecode(withPrefix);

    if (typeof decoded === 'string') {
        throw new Error(`Not a valid cash address: ${decoded}`);
    }

    return decoded.bytecode;
}

export interface IssuePlan {
    transaction: TransactionCommon;
    sourceOutput: Output;
    /** Satoshis returned to the coin's own address; zero means no change output. */
    changeSatoshis: bigint;
}

export function buildIssue(coin: Coin, voucherSatoshis: bigint, hash: Uint8Array): IssuePlan {
    if (voucherSatoshis < MINIMUM_VOUCHER_SATOSHIS) {
        throw new Error(`A voucher must hold at least ${MINIMUM_VOUCHER_SATOSHIS} sats.`);
    }

    const changeSatoshis = coin.valueSatoshis - voucherSatoshis - ISSUE_FEE_SATOSHIS;

    if (changeSatoshis < DUST_SATOSHIS) {
        throw new Error(`That coin (${coin.valueSatoshis} sats) is too small: it needs ${voucherSatoshis + ISSUE_FEE_SATOSHIS + DUST_SATOSHIS} sats for this voucher.`);
    }

    const own = walletLockingBytecode(coin.publicKey);

    return {
        transaction: {
            version: 2,
            locktime: 0,
            inputs: [{ outpointTransactionHash: hexToBin(coin.transactionHash), outpointIndex: coin.outputIndex, sequenceNumber: 0xfffffffe, unlockingBytecode: new Uint8Array() }],
            outputs: [
                { lockingBytecode: voucherLockingBytecode(hash), valueSatoshis: voucherSatoshis },
                { lockingBytecode: own, valueSatoshis: changeSatoshis },
            ],
        },
        sourceOutput: { lockingBytecode: own, valueSatoshis: coin.valueSatoshis },
        changeSatoshis,
    };
}

/** The signTransaction request body in relay-safe JSON form (hex strings and "<bigint: Xn>"). */
export function buildIssueSignRequest(coin: Coin, voucherSatoshis: bigint, hash: Uint8Array) {
    const { transaction, sourceOutput } = buildIssue(coin, voucherSatoshis, hash);
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
        userPrompt: `XOGrid: lock ${voucherSatoshis} sats in a claim-code voucher. The network fee is ${ISSUE_FEE_SATOSHIS} sats; the rest returns to your own address.`,
    };
}

export interface Verdict {
    valid: boolean;
    reason?: string;
    transactionHex?: string;
    transactionId?: string;
}

const same = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((byte, i) => byte === b[i]);

/** Checks the wallet returned exactly the issue transaction we asked for, correctly signed. */
export function verifySignedIssue(coin: Coin, voucherSatoshis: bigint, hash: Uint8Array, signedHex: string): Verdict {
    if (!/^([0-9a-fA-F]{2}){1,100000}$/.test(signedHex)) {
        return { valid: false, reason: 'the wallet did not return transaction hex' };
    }

    const decoded = decodeTransaction(hexToBin(signedHex));

    if (typeof decoded === 'string') {
        return { valid: false, reason: `could not decode the signed transaction: ${decoded}` };
    }

    const { transaction: expected, sourceOutput } = buildIssue(coin, voucherSatoshis, hash);
    const input = decoded.inputs[0];
    const expectedInput = expected.inputs[0]!;

    if (decoded.version !== expected.version || decoded.locktime !== expected.locktime) {
        return { valid: false, reason: 'unexpected version or locktime' };
    }

    if (decoded.inputs.length !== 1 || decoded.outputs.length !== expected.outputs.length || !input) {
        return { valid: false, reason: 'the wallet changed the number of inputs or outputs' };
    }

    if (!same(input.outpointTransactionHash, expectedInput.outpointTransactionHash) || input.outpointIndex !== expectedInput.outpointIndex || input.sequenceNumber !== expectedInput.sequenceNumber) {
        return { valid: false, reason: 'the wallet changed the input' };
    }

    for (const [index, wanted] of expected.outputs.entries()) {
        const got = decoded.outputs[index]!;

        if (!same(got.lockingBytecode, wanted.lockingBytecode) || got.valueSatoshis !== wanted.valueSatoshis || got.token !== undefined) {
            return { valid: false, reason: `the wallet changed output ${index}` };
        }
    }

    const result = createVirtualMachineBch2026().verify({ sourceOutputs: [sourceOutput], transaction: decoded });

    if (result !== true) {
        return { valid: false, reason: `signature check failed: ${String(result)}` };
    }

    const bytes = encodeTransaction(decoded);

    return { valid: true, transactionHex: binToHex(bytes), transactionId: binToHex(hash256(bytes).reverse()) };
}

export interface VoucherCoin {
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
}

/** The claim transaction, fully formed: it needs no signature, only the code. */
export function buildClaim(voucher: VoucherCoin, code: Uint8Array, destination: Uint8Array): { transaction: TransactionCommon; sourceOutput: Output } {
    const value = voucher.valueSatoshis - CLAIM_FEE_SATOSHIS;

    if (value < DUST_SATOSHIS) {
        throw new Error(`This voucher holds ${voucher.valueSatoshis} sats, too little to claim after the ${CLAIM_FEE_SATOSHIS} sat fee.`);
    }

    return {
        transaction: {
            version: 2,
            locktime: 0,
            inputs: [{ outpointTransactionHash: hexToBin(voucher.transactionHash), outpointIndex: voucher.outputIndex, sequenceNumber: 0xfffffffe, unlockingBytecode: voucherUnlockingBytecode(code) }],
            outputs: [{ lockingBytecode: destination, valueSatoshis: value }],
        },
        sourceOutput: { lockingBytecode: voucherLockingBytecode(codeHash(code)), valueSatoshis: voucher.valueSatoshis },
    };
}

/** Builds the claim and proves in the BCH virtual machine that it is valid before anything is broadcast. */
export function prepareClaim(voucher: VoucherCoin, code: Uint8Array, destination: Uint8Array): Verdict {
    const { transaction, sourceOutput } = buildClaim(voucher, code, destination);
    const result = createVirtualMachineBch2026().verify({ sourceOutputs: [sourceOutput], transaction });

    if (result !== true) {
        return { valid: false, reason: `the code does not unlock this voucher: ${String(result)}` };
    }

    const bytes = encodeTransaction(transaction);

    return { valid: true, transactionHex: binToHex(bytes), transactionId: binToHex(hash256(bytes).reverse()) };
}

/** A shareable claim link fragment. The code lives only in the fragment, which browsers never send to a server. */
export const claimFragment = (code: Uint8Array, network: Network): string => `#claim=${binToHex(code)}&network=${network}`;

export function parseClaimFragment(fragment: string): { code?: string; network?: Network } {
    const params = new URLSearchParams(fragment.replace(/^#/, ''));
    const network = params.get('network');

    return { code: params.get('claim') ?? undefined, network: network === 'chipnet' || network === 'mainnet' ? network : undefined };
}
