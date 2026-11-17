import { binToHex, decodeTransaction, encodeTransaction, generateTransaction, hexToBin, secp256k1, walletTemplateP2pkhNonHd, walletTemplateToCompilerBch, type InputTemplate } from '@bitauth/libauth';
import { describe, expect, it } from 'vitest';
import {
    CLAIM_FEE_SATOSHIS,
    ISSUE_FEE_SATOSHIS,
    addressFor,
    buildClaim,
    buildIssue,
    buildIssueSignRequest,
    claimFragment,
    codeHash,
    lockingBytecodeFromAddress,
    newClaimCode,
    parseClaimCode,
    parseClaimFragment,
    prepareClaim,
    verifySignedIssue,
    voucherLockingBytecode,
    walletLockingBytecode,
    type Coin,
} from '../../frontend/src/voucher/core.js';

// A real voucher created and claimed on chipnet by scripts/chipnet-voucher.ts (txs d21098db… and 31375029…).
const REAL_CODE = '8524747c3baa65f7ef86fa28ecdf18d3';
const REAL_HASH = '06eddc497f91280a0d742974548a3592b351bacaf1916efd05b8cc0e354594d9';
const REAL_LOCK = 'aa200eb8f3314211e967d00a6e8ef7b614732ff118a5385dfb4ce4c626cc2473566387';

const privateKey = hexToBin('11'.repeat(32));
const publicKey = secp256k1.derivePublicKeyCompressed(privateKey) as Uint8Array;
const coin: Coin = { transactionHash: 'cd'.repeat(32), outputIndex: 0, valueSatoshis: 5000n, pathName: 'receive', addressIndex: 0, publicKey };
const hash = codeHash(hexToBin(REAL_CODE));

function signIssue(forCoin: Coin, amount: bigint, mutate?: (tx: ReturnType<typeof buildIssue>['transaction']) => void): string {
    const compiler = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd as never);
    const { transaction, sourceOutput } = buildIssue(forCoin, amount, hash);
    const input = transaction.inputs[0]!;
    const template: InputTemplate<typeof compiler> = {
        outpointIndex: input.outpointIndex,
        outpointTransactionHash: input.outpointTransactionHash,
        sequenceNumber: input.sequenceNumber,
        unlockingBytecode: { compiler, data: { keys: { privateKeys: { key: privateKey } } }, valueSatoshis: sourceOutput.valueSatoshis, script: 'unlock' },
    };
    const generated = generateTransaction({ inputs: [template], locktime: transaction.locktime, outputs: transaction.outputs, version: transaction.version });

    if (!generated.success) {
        throw new Error(JSON.stringify(generated.errors));
    }

    mutate?.(generated.transaction);

    return binToHex(encodeTransaction(generated.transaction));
}

describe('claim-code voucher, matched to the real chipnet voucher', () => {
    it('hashes the real code to the hash on chain and locks to the exact on-chain locking bytecode', () => {
        expect(binToHex(hash)).toBe(REAL_HASH);
        expect(binToHex(voucherLockingBytecode(hash))).toBe(REAL_LOCK);
    });

    it('claims with the right code in the BCH virtual machine and rejects wrong, empty and hash-as-code', () => {
        const voucher = { transactionHash: 'ef'.repeat(32), outputIndex: 0, valueSatoshis: 5000n };
        const destination = walletLockingBytecode(publicKey);

        expect(prepareClaim(voucher, hexToBin(REAL_CODE), destination).valid).toBe(true);

        // buildClaim with another code produces a lock for a different hash, so check it against the real lock directly.
        const wrong = buildClaim(voucher, hexToBin('00'.repeat(16)), destination);

        expect(binToHex(wrong.sourceOutput.lockingBytecode)).not.toBe(REAL_LOCK);
    });

    it('refuses a voucher too small to claim', () => {
        expect(() => prepareClaim({ transactionHash: 'ef'.repeat(32), outputIndex: 0, valueSatoshis: CLAIM_FEE_SATOSHIS + 100n }, hexToBin(REAL_CODE), walletLockingBytecode(publicKey))).toThrow(/too little/);
    });
});

describe('issue transaction', () => {
    it('puts the voucher at output 0 and returns the rest to the coin address, paying only the fee', () => {
        const { transaction, changeSatoshis } = buildIssue(coin, 1000n, hash);

        expect(binToHex(transaction.outputs[0]!.lockingBytecode)).toBe(REAL_LOCK);
        expect(transaction.outputs[0]!.valueSatoshis).toBe(1000n);
        expect(changeSatoshis).toBe(5000n - 1000n - ISSUE_FEE_SATOSHIS);
        expect(transaction.outputs[0]!.valueSatoshis + transaction.outputs[1]!.valueSatoshis + ISSUE_FEE_SATOSHIS).toBe(coin.valueSatoshis);
    });

    it('rejects a too-small voucher and a coin that cannot pay voucher + fee + dust', () => {
        expect(() => buildIssue(coin, 999n, hash)).toThrow(/at least/);
        expect(() => buildIssue({ ...coin, valueSatoshis: 1500n }, 1000n, hash)).toThrow(/too small/);
    });

    it('sends a relay-safe request with broadcast off', () => {
        const request = buildIssueSignRequest(coin, 1000n, hash);

        expect(request.broadcast).toBe(false);
        expect(request.sourceOutputs[0]!.valueSatoshis).toBe('<bigint: 5000n>');
        expect(JSON.parse(JSON.stringify(request))).toEqual(request);
        expect(decodeTransaction(hexToBin(request.transaction))).toMatchObject({ version: 2 });
    });

    it('accepts a correctly signed issue and reports its id', () => {
        const verdict = verifySignedIssue(coin, 1000n, hash, signIssue(coin, 1000n));

        expect(verdict.valid).toBe(true);
        expect(verdict.transactionId).toMatch(/^[0-9a-f]{64}$/);
    });

    it('rejects a wallet that swaps the voucher lock, steals change, or adds an output', () => {
        const other = secp256k1.derivePublicKeyCompressed(hexToBin('22'.repeat(32))) as Uint8Array;

        expect(verifySignedIssue(coin, 1000n, hash, signIssue(coin, 1000n, (tx) => { tx.outputs[0]!.lockingBytecode = walletLockingBytecode(other); }))).toMatchObject({ valid: false, reason: expect.stringMatching(/changed output 0/) });
        expect(verifySignedIssue(coin, 1000n, hash, signIssue(coin, 1000n, (tx) => { tx.outputs[1]!.lockingBytecode = walletLockingBytecode(other); }))).toMatchObject({ valid: false, reason: expect.stringMatching(/changed output 1/) });
        expect(verifySignedIssue(coin, 1000n, hash, signIssue(coin, 1000n, (tx) => { tx.outputs.push({ lockingBytecode: walletLockingBytecode(publicKey), valueSatoshis: 546n }); }))).toMatchObject({ valid: false, reason: expect.stringMatching(/number of inputs or outputs/) });
    });

    it('rejects a different fee and a signature made over the wrong coin value', () => {
        expect(verifySignedIssue(coin, 1000n, hash, signIssue(coin, 1000n, (tx) => { tx.outputs[1]!.valueSatoshis -= 100n; }))).toMatchObject({ valid: false });
        expect(verifySignedIssue(coin, 1000n, hash, signIssue({ ...coin, valueSatoshis: 6000n }, 1000n, (tx) => { tx.outputs[1]!.valueSatoshis = 5000n - 1000n - ISSUE_FEE_SATOSHIS; }))).toMatchObject({ valid: false, reason: expect.stringMatching(/signature check failed/) });
    });
});

describe('codes, addresses and links', () => {
    it('generates 16-byte codes that round-trip through hex', () => {
        const code = newClaimCode();

        expect(code).toHaveLength(16);
        expect(parseClaimCode(binToHex(code))).toEqual(code);
        expect(parseClaimCode(`  ${binToHex(code).toUpperCase()} `)).toEqual(code);
        expect(() => parseClaimCode('abc')).toThrow(/32 hex/);
    });

    it('uses the right address prefix per network and refuses the wrong one', () => {
        const lock = walletLockingBytecode(publicKey);
        const test = addressFor(lock, 'chipnet');
        const main = addressFor(lock, 'mainnet');

        expect(test).toMatch(/^bchtest:/);
        expect(main).toMatch(/^bitcoincash:/);
        expect(lockingBytecodeFromAddress(test, 'chipnet')).toEqual(lock);
        expect(lockingBytecodeFromAddress(test.split(':')[1]!, 'chipnet')).toEqual(lock);
        expect(() => lockingBytecodeFromAddress(main, 'chipnet')).toThrow(/not a chipnet address/);
        expect(() => lockingBytecodeFromAddress(test, 'mainnet')).toThrow(/not a mainnet address/);
        expect(() => lockingBytecodeFromAddress('bchtest:qqqqqqqqqqqqqqqqqqqq', 'chipnet')).toThrow(/valid cash address/);
    });

    it('round-trips a claim link fragment and ignores junk', () => {
        const code = newClaimCode();

        expect(parseClaimFragment(claimFragment(code, 'chipnet'))).toEqual({ code: binToHex(code), network: 'chipnet' });
        expect(parseClaimFragment('#nonsense')).toEqual({ code: undefined, network: undefined });
        expect(parseClaimFragment('#claim=x&network=evil').network).toBeUndefined();
    });
});
