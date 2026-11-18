/**
 * Read-only Electrum lookups from the browser (WebSocket). Host lists match frontend/src/voucher/core.ts.
 * This tool never broadcasts: the XO wallet that imports an invitation does.
 */
import { binToHex, sha256 } from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';
import type { Network } from './invitation';

const HOSTS: Record<Network, string[]> = {
    chipnet: ['chipnet.imaginary.cash', 'chipnet.bch.ninja'],
    mainnet: ['bch.imaginary.cash', 'electrum.imaginary.cash', 'cashnode.bch.ninja', 'fulcrum.greyh.at'],
};

export type NftCapability = 'none' | 'mutable' | 'minting';

/** CashTokens on a coin, as Electrum reports them: category in display (big-endian) hex, commitment in hex. */
export interface CoinToken {
    category: string;
    amount: bigint;
    nft?: { capability: NftCapability; commitment: string };
}

export interface UnspentCoin {
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
    /** Block height, or 0 while unconfirmed. */
    height: number;
    hasTokens: boolean;
    token?: CoinToken;
}

interface ElectrumUnspent {
    tx_hash: string;
    tx_pos: number;
    value: number;
    height: number;
    token_data?: { category: string; amount?: string | number; nft?: { capability: NftCapability; commitment?: string } };
}

const toCoinToken = (data: NonNullable<ElectrumUnspent['token_data']>): CoinToken => ({
    category: data.category,
    amount: BigInt(data.amount ?? 0),
    ...(data.nft ? { nft: { capability: data.nft.capability, commitment: data.nft.commitment ?? '' } } : {}),
});

/** Electrum's script hash: sha256 of the locking bytecode, byte-reversed. */
export const electrumScriptHash = (lockingBytecode: Uint8Array): string => binToHex(sha256.hash(lockingBytecode).reverse());

async function withClient<Result>(network: Network, use: (request: (method: string, ...parameters: string[]) => Promise<unknown>) => Promise<Result>): Promise<Result> {
    const failures: string[] = [];

    for (const host of HOSTS[network]) {
        const client = new ElectrumClient('XOGrid-template-tools', '1.4.1', host);

        try {
            await client.connect();
        } catch (error) {
            failures.push(`${host}: ${error instanceof Error ? error.message : String(error)}`);
            continue;
        }

        try {
            return await use(async (method, ...parameters) => {
                const result = await client.request(method, ...parameters);

                if (result instanceof Error) {
                    throw result;
                }

                return result;
            });
        } finally {
            await client.disconnect(true).catch(() => undefined);
        }
    }

    throw new Error(`No ${network} Electrum server reachable. ${failures.join('; ')}`);
}

/** Unspent coins at a locking bytecode, plus the current tip height. Uses listunspent, never the address history. */
export async function listUnspentCoins(network: Network, lockingBytecode: Uint8Array): Promise<{ coins: UnspentCoin[]; tipHeight: number }> {
    return withClient(network, async (request) => {
        const unspent = (await request('blockchain.scripthash.listunspent', electrumScriptHash(lockingBytecode))) as ElectrumUnspent[];
        const tip = (await request('blockchain.headers.get_tip')) as { height: number };
        const coins = unspent.map((coin) => ({
            transactionHash: coin.tx_hash,
            outputIndex: coin.tx_pos,
            valueSatoshis: BigInt(coin.value),
            height: coin.height > 0 ? coin.height : 0,
            hasTokens: coin.token_data !== undefined,
            ...(coin.token_data ? { token: toCoinToken(coin.token_data) } : {}),
        }));

        return { coins: coins.sort((a, b) => (b.valueSatoshis > a.valueSatoshis ? 1 : b.valueSatoshis < a.valueSatoshis ? -1 : 0)), tipHeight: tip.height };
    });
}
