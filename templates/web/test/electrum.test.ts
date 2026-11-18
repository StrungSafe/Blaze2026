import { describe, expect, it } from 'vitest';
import { toUnspentCoin, type ElectrumUnspent } from '../src/lib/electrum';

// Mainnet TokenBurner coins as Fulcrum returned them on 2026-11-18 for listunspent(..., 'include_tokens').
// Without the filter the same server returned [], which is why the page showed no token coins.
const MAINNET_BURNER_UNSPENT: ElectrumUnspent[] = [
    {
        height: 977906,
        token_data: { amount: '186700000000', category: 'fc862c3d75b2b263668b73dd69e467303cc8a471476bff0223911cda472b7c57' },
        tx_hash: '5d058db066b9de5d2c7ff2d4d269104cf4f076f3b67514372a72d279b5338226',
        tx_pos: 0,
        value: 1000,
    },
    {
        height: 977909,
        token_data: { amount: '1452', category: 'b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366' },
        tx_hash: '8234994257465b467cb52c0b89e8460e10a871f4c445e9ac4e48b027fac59ef9',
        tx_pos: 2,
        value: 1000,
    },
];

describe('Electrum listunspent parsing (web tool)', () => {
    it('reads token coins with their fungible amounts and categories', () => {
        const [first, second] = MAINNET_BURNER_UNSPENT.map(toUnspentCoin);

        expect(first).toEqual({
            transactionHash: '5d058db066b9de5d2c7ff2d4d269104cf4f076f3b67514372a72d279b5338226',
            outputIndex: 0,
            valueSatoshis: 1000n,
            height: 977906,
            hasTokens: true,
            token: { category: 'fc862c3d75b2b263668b73dd69e467303cc8a471476bff0223911cda472b7c57', amount: 186_700_000_000n },
        });
        expect(second!.token).toEqual({ category: 'b38a33f750f84c5c169a6f23cb873e6e79605021585d4f3408789689ed87f366', amount: 1452n });
        expect(second!.outputIndex).toBe(2);
    });

    it('reads NFTs, plain coins and unconfirmed coins', () => {
        const nft = toUnspentCoin({
            tx_hash: 'ab'.repeat(32),
            tx_pos: 1,
            value: 800,
            height: 0,
            token_data: { category: 'cd'.repeat(32), amount: '0', nft: { capability: 'mutable', commitment: 'cafe' } },
        });
        const plain = toUnspentCoin({ tx_hash: 'ef'.repeat(32), tx_pos: 0, value: 4812, height: -1 });

        expect(nft.token).toEqual({ category: 'cd'.repeat(32), amount: 0n, nft: { capability: 'mutable', commitment: 'cafe' } });
        expect(nft.height).toBe(0);
        expect(plain).toEqual({ transactionHash: 'ef'.repeat(32), outputIndex: 0, valueSatoshis: 4812n, height: 0, hasTokens: false });
    });
});
