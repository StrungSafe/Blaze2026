/**
 * Test CashTokens on CHIPNET, for systems whose chipnet scripts need tokens to move.
 *
 * The XO engine has no token-genesis action, so genesis is built here with Libauth from a small "minter" key kept
 * next to the test wallet (contracts/.xo-demo/minter-key.txt, gitignored). Flow:
 *   1. the XO wallet pays the minter address (output 0 of that transaction, so it can serve as a genesis input);
 *   2. the minter spends that coin in a genesis transaction that sends the new fungible tokens to an address of the
 *      XO wallet, and the leftover satoshis back to the XO wallet.
 * The category ID equals the txid of the coin spent at genesis.
 */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
    binToHex,
    createVirtualMachineBch2026,
    decodeTransactionBch,
    encodeTransactionBch,
    generateTransaction,
    hash160,
    hashTransactionUiOrder,
    hexToBin,
    secp256k1,
    walletTemplateP2pkhNonHd,
    walletTemplateToCompilerBch,
    type Output,
} from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';

const CHIPNET_ELECTRUM_HOST = 'chipnet.imaginary.cash';

export interface MinterKey {
    privateKey: Uint8Array;
    lockingBytecode: Uint8Array;
}

/** The minter key for this test wallet, created on first use. Test money only. */
export function loadOrCreateMinterKey(folder: string): MinterKey {
    const file = join(folder, 'minter-key.txt');

    if (!existsSync(file)) {
        writeFileSync(file, binToHex(randomBytes(32)), { mode: 0o600 });
    }

    const privateKey = hexToBin(readFileSync(file, 'utf8').trim());
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);

    if (typeof publicKey === 'string') {
        throw new Error(publicKey);
    }

    return { privateKey, lockingBytecode: new Uint8Array([0x76, 0xa9, 0x14, ...hash160(publicKey), 0x88, 0xac]) };
}

/** Finds the output of a serialized transaction that pays `lockingBytecode`. */
export function findOutputIndex(serializedTransaction: string, lockingBytecode: Uint8Array): number {
    const decoded = decodeTransactionBch(hexToBin(serializedTransaction));

    if (typeof decoded === 'string') {
        throw new Error(decoded);
    }

    return decoded.outputs.findIndex((output) => binToHex(output.lockingBytecode) === binToHex(lockingBytecode));
}

/**
 * The current chipnet block height, straight from Electrum. The engine's own chain status relies on header sync, which
 * fails on chipnet since the November 2026 one-minute-block upgrade (see revenue-split/README.md).
 */
export async function getChipnetTipHeight(): Promise<number> {
    const client = new ElectrumClient('xogrid-contracts', '1.4.1', CHIPNET_ELECTRUM_HOST);

    await client.connect();

    try {
        const tip = (await client.request('blockchain.headers.get_tip')) as { height: number } | Error;

        if (tip instanceof Error) {
            throw tip;
        }

        return tip.height;
    } finally {
        await client.disconnect(true);
    }
}

/** Broadcasts a raw transaction to a chipnet Electrum server and returns its txid. */
export async function broadcastToChipnet(serializedTransaction: string): Promise<string> {
    const client = new ElectrumClient('xogrid-contracts', '1.4.1', CHIPNET_ELECTRUM_HOST);

    await client.connect();

    try {
        const result = await client.request('blockchain.transaction.broadcast', serializedTransaction);

        if (result instanceof Error) {
            throw result;
        }

        return String(result);
    } finally {
        await client.disconnect(true);
    }
}

export interface GenesisParameters {
    minter: MinterKey;
    /** The minter's coin to spend. It must be output 0 of its transaction. */
    coin: { transactionHash: string; outputIndex: number; valueSatoshis: bigint };
    tokenAmount: bigint;
    tokenSatoshis: bigint;
    tokenRecipient: Uint8Array;
    changeRecipient: Uint8Array;
    feeSatoshis?: bigint;
    /** Also create an NFT of the new category on the token output (for example a minting NFT that holds the supply). */
    nft?: { capability: 'none' | 'mutable' | 'minting'; commitment: Uint8Array };
}

/** Builds, VM-checks and returns a signed fungible-token genesis transaction. */
export function buildFungibleGenesis(parameters: GenesisParameters): { category: string; serializedTransaction: string; transactionHash: string } {
    const { minter, coin, tokenAmount, tokenSatoshis, tokenRecipient, changeRecipient, feeSatoshis = 500n, nft } = parameters;

    if (coin.outputIndex !== 0) {
        throw new Error(`A genesis input must be output 0 of its transaction; this coin is output ${coin.outputIndex}.`);
    }

    const category = hexToBin(coin.transactionHash);
    const changeSatoshis = coin.valueSatoshis - tokenSatoshis - feeSatoshis;
    const outputs: Output[] = [{ lockingBytecode: tokenRecipient, valueSatoshis: tokenSatoshis, token: { category, amount: tokenAmount, ...(nft ? { nft } : {}) } }];

    if (changeSatoshis >= 546n) {
        outputs.push({ lockingBytecode: changeRecipient, valueSatoshis: changeSatoshis });
    }

    const compiler = walletTemplateToCompilerBch(walletTemplateP2pkhNonHd);
    const generated = generateTransaction({
        version: 2,
        locktime: 0,
        inputs: [
            {
                outpointTransactionHash: category,
                outpointIndex: 0,
                sequenceNumber: 0xffffffff,
                unlockingBytecode: {
                    compiler,
                    data: { keys: { privateKeys: { key: minter.privateKey } } },
                    script: 'unlock',
                    valueSatoshis: coin.valueSatoshis,
                },
            },
        ],
        outputs,
    });

    if (!generated.success) {
        throw new Error(`Genesis transaction could not be generated: ${JSON.stringify(generated.errors)}`);
    }

    const sourceOutputs: Output[] = [{ lockingBytecode: minter.lockingBytecode, valueSatoshis: coin.valueSatoshis }];
    const verified = createVirtualMachineBch2026().verify({ sourceOutputs, transaction: generated.transaction });

    if (verified !== true) {
        throw new Error(`Genesis transaction failed VM verification: ${verified}`);
    }

    const encoded = encodeTransactionBch(generated.transaction);

    return { category: binToHex(category), serializedTransaction: binToHex(encoded), transactionHash: binToHex(hashTransactionUiOrder(encoded)) };
}
