/**
 * Token Burner invitations (see token-burner/README.md).
 *
 * Coins at the shared TokenBurner address can be spent by anyone, with no signature, in a transaction whose only output
 * is a token-free OP_RETURN: the burn destroys their tokens and gives their satoshis to the miner. So the invitation
 * carries everything — the burner coins as inputs, each input's unlocking bytecode (the redeem script push), the
 * farewell message and the OP_RETURN output — and the importing XO wallet only broadcasts it.
 *
 * Deposits are ordinary sends from a wallet's own coins, which the XO wallet makes itself from the template's
 * deposit actions, so they are not built here.
 */
import {
    cashAssemblyToBin,
    encodeDataPush,
    encodeLockingBytecodeP2sh32,
    flattenBinArray,
    hash256,
    hexToBin,
    lockingBytecodeToCashAddress,
    utf8ToBin,
    type Output,
} from '@bitauth/libauth';
import type { InvitationInputWithSpentOutputFields } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import templateText from '../../../token-burner/template.json?raw';
import type { CoinToken } from './electrum';
import { finishInvitation, startInvitation, type FinishedInvitation, type Network } from './invitation';

export const tokenBurnerTemplate = parseTemplate(templateText);
export const tokenBurnerTemplateIdentifier = generateTemplateIdentifier(tokenBurnerTemplate);

/**
 * The longest farewell message this page accepts. The template says "up to 220 bytes", but Libauth's standardness check
 * counts the output script's length byte toward the 223-byte data-carrier limit, so 220 bytes measures 224 and fails
 * the VM check this page runs. 219 passes everywhere.
 */
export const MAX_BURN_MESSAGE_BYTES = 219;

const redeemScript = (() => {
    const compiled = cashAssemblyToBin(tokenBurnerTemplate.scripts.burnerBytecode as string);

    if (typeof compiled === 'string') {
        throw new Error(`TokenBurner redeem script does not compile: ${compiled}`);
    }

    return compiled;
})();

export const tokenBurnerLockingBytecode = encodeLockingBytecodeP2sh32(hash256(redeemScript));
/** P2SH32 unlocking: `burn()` takes no arguments, so this is just the redeem script push. */
export const tokenBurnerUnlockingBytecode = encodeDataPush(redeemScript);

/** The token-aware address (r…), as tokenburner.cash shows it: wallets need it to send tokens. */
export const tokenBurnerAddress = (network: Network): string => {
    const encoded = lockingBytecodeToCashAddress({
        bytecode: tokenBurnerLockingBytecode,
        prefix: network === 'mainnet' ? 'bitcoincash' : 'bchtest',
        tokenSupport: true,
    });

    if (typeof encoded === 'string') {
        throw new Error(`TokenBurner address could not be encoded: ${encoded}`);
    }

    return encoded.address;
};

export const burnMessageBytes = (message: string): number => utf8ToBin(message).length;

/** The template's `farewellBytecode`: OP_RETURN <burnMessage> (an empty message pushes OP_0). */
export const farewellLockingBytecode = (message: string): Uint8Array => flattenBinArray([Uint8Array.of(0x6a), encodeDataPush(utf8ToBin(message))]);

export interface BurnerCoin {
    /** Display (big-endian) txid, as block explorers and Electrum show it. */
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
    token?: CoinToken;
}

export interface TokenBurnInvitation extends FinishedInvitation {
    coinCount: number;
    /** All the coins' satoshis: the fee, paid to the miner. */
    feeSatoshis: bigint;
    fungibleTokens: { category: string; amount: bigint }[];
    nftCount: number;
}

const toLibauthToken = (token: CoinToken): NonNullable<Output['token']> => ({
    category: hexToBin(token.category),
    amount: token.amount,
    ...(token.nft ? { nft: { capability: token.nft.capability, commitment: hexToBin(token.nft.commitment) } } : {}),
});

export function buildTokenBurnInvitation(network: Network, coins: BurnerCoin[], message: string): TokenBurnInvitation {
    if (coins.length === 0) {
        throw new Error('Pick at least one burner coin.');
    }

    const outpoints = new Set<string>();

    for (const coin of coins) {
        if (!/^[0-9a-f]{64}$/i.test(coin.transactionHash) || !Number.isInteger(coin.outputIndex) || coin.outputIndex < 0) {
            throw new Error('Enter each coin as a 64-character transaction id and an output index.');
        }

        if (coin.valueSatoshis <= 0n) {
            throw new Error('Each coin value must be positive.');
        }

        const outpoint = `${coin.transactionHash.toLowerCase()}:${coin.outputIndex}`;

        if (outpoints.has(outpoint)) {
            throw new Error(`The coin ${outpoint} is listed twice.`);
        }

        outpoints.add(outpoint);
    }

    if (burnMessageBytes(message) > MAX_BURN_MESSAGE_BYTES) {
        throw new Error(`The farewell message is ${burnMessageBytes(message)} bytes; the limit is ${MAX_BURN_MESSAGE_BYTES}.`);
    }

    const draft = startInvitation({ templateIdentifier: tokenBurnerTemplateIdentifier, actionIdentifier: 'burn', network });
    // Each input also carries the spent coin's value and tokens, as XO wallets write them.
    const inputs: InvitationInputWithSpentOutputFields[] = coins.map((coin, index) => ({
        outpointTransactionHash: hexToBin(coin.transactionHash),
        outpointIndex: coin.outputIndex,
        inputIdentifier: 'burnerInput',
        transactionIndex: index,
        valueSatoshis: coin.valueSatoshis,
        ...(coin.token ? { token: toLibauthToken(coin.token) } : {}),
    }));

    draft.commit({ roleIdentifier: 'burner' });
    const inputCommit = draft.commit({ inputs });
    draft.commit({ variables: [{ variableIdentifier: 'burnMessage', value: message, roleIdentifier: 'burner' }] });
    // The contract's only rule: exactly one output, token-free, starting with OP_RETURN.
    draft.commit({ outputs: [{ outputIdentifier: 'farewellOutput', transactionIndex: 0, valueSatoshis: 0n, lockingBytecode: farewellLockingBytecode(message) }] });
    // Each input's unlocking bytecode, filled into the input commit above (XO's mergesWith).
    draft.commit({ inputs: coins.map((_, itemIndex) => ({ mergesWith: { commitIdentifier: inputCommit, itemIndex }, unlockingBytecode: tokenBurnerUnlockingBytecode })) });

    const finished = finishInvitation({
        draft,
        template: tokenBurnerTemplate,
        actionIdentifier: 'burn',
        network,
        sourceOutputs: coins.map((coin) => ({
            lockingBytecode: tokenBurnerLockingBytecode,
            valueSatoshis: coin.valueSatoshis,
            ...(coin.token ? { token: toLibauthToken(coin.token) } : {}),
        })),
    });
    const fungible = new Map<string, bigint>();

    for (const coin of coins) {
        if (coin.token && coin.token.amount > 0n) {
            fungible.set(coin.token.category, (fungible.get(coin.token.category) ?? 0n) + coin.token.amount);
        }
    }

    return {
        ...finished,
        coinCount: coins.length,
        feeSatoshis: coins.reduce((sum, coin) => sum + coin.valueSatoshis, 0n),
        fungibleTokens: [...fungible].map(([category, amount]) => ({ category, amount })),
        nftCount: coins.filter((coin) => coin.token?.nft).length,
    };
}
