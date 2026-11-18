/**
 * Drip Mine invitations (see drip-mine/README.md).
 *
 * A Drip Mine coin needs no signature: anyone can spend it once it is at least one block old. So the invitation carries
 * everything — the coin as input, its unlocking bytecode (the redeem script push, P2SH32's "contract signature") and
 * the output — and the importing XO wallet only broadcasts it.
 *   drip       coin > 740 sats: send coin − payout back to the Drip Mine; the payout is the fee
 *   terminate  coin ≤ 740 sats: pay it out whole as the fee, into a 0-sat bare OP_RETURN
 */
import { cashAssemblyToBin, encodeDataPush, encodeLockingBytecodeP2sh32, hash256, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import type { InvitationInputWithSpentOutputFields } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate } from '@xo-cash/utils';
import templateText from '../../../drip-mine/template.json?raw';
import { finishInvitation, startInvitation, type FinishedInvitation, type Network } from './invitation';

export const dripMineTemplate = parseTemplate(templateText);
export const dripMineTemplateIdentifier = generateTemplateIdentifier(dripMineTemplate);

const constant = (identifier: string): bigint => {
    const value = dripMineTemplate.constants?.[identifier]?.value;

    if (typeof value !== 'bigint') {
        throw new Error(`Drip Mine template constant ${identifier} is missing.`);
    }

    return value;
};

const DUST_LIMIT = constant('dustLimit');
const MIN_PAYOUT = constant('minPayout');
const DECAY_NUMERATOR = constant('decayNumerator');
const DECAY_DENOMINATOR = constant('decayDenominator');

/** Coins of this value or less can only be terminated (a drip would leave less than dust behind). */
export const TERMINATE_AT_OR_BELOW = DUST_LIMIT + MIN_PAYOUT;

const redeemScript = (() => {
    const compiled = cashAssemblyToBin(dripMineTemplate.scripts.dripMineBytecode as string);

    if (typeof compiled === 'string') {
        throw new Error(`Drip Mine redeem script does not compile: ${compiled}`);
    }

    return compiled;
})();

export const dripMineLockingBytecode = encodeLockingBytecodeP2sh32(hash256(redeemScript));
/** P2SH32 unlocking: the contract has one function and takes no arguments, so this is just the redeem script push. */
export const dripMineUnlockingBytecode = encodeDataPush(redeemScript);
const TERMINAL_LOCKING_BYTECODE = hexToBin('6a');

export const dripMineAddress = (network: Network): string => {
    const encoded = lockingBytecodeToCashAddress({ bytecode: dripMineLockingBytecode, prefix: network === 'mainnet' ? 'bitcoincash' : 'bchtest' });

    if (typeof encoded === 'string') {
        throw new Error(`Drip Mine address could not be encoded: ${encoded}`);
    }

    return encoded.address;
};

export type DripMineAction = 'drip' | 'terminate';

export const dripMineActionFor = (coinSatoshis: bigint): DripMineAction => (coinSatoshis <= TERMINATE_AT_OR_BELOW ? 'terminate' : 'drip');

/** The fee a spend of this coin pays the miner: the template's `dripPayout`, or the whole coin when terminating. */
export const dripMinePayout = (coinSatoshis: bigint): bigint => {
    if (dripMineActionFor(coinSatoshis) === 'terminate') {
        return coinSatoshis;
    }

    const proportional = (coinSatoshis * DECAY_NUMERATOR) / DECAY_DENOMINATOR;

    return proportional > MIN_PAYOUT ? proportional : MIN_PAYOUT;
};

export interface DripMineCoin {
    /** Display (big-endian) txid, as block explorers and Electrum show it. */
    transactionHash: string;
    outputIndex: number;
    valueSatoshis: bigint;
}

export interface DripMineInvitation extends FinishedInvitation {
    action: DripMineAction;
    payoutSatoshis: bigint;
    remainderSatoshis: bigint;
}

export function buildDripMineInvitation(network: Network, coin: DripMineCoin): DripMineInvitation {
    if (!/^[0-9a-f]{64}$/i.test(coin.transactionHash) || !Number.isInteger(coin.outputIndex) || coin.outputIndex < 0) {
        throw new Error('Enter the coin as a 64-character transaction id and an output index.');
    }

    if (coin.valueSatoshis <= 0n) {
        throw new Error('The coin value must be positive.');
    }

    const action = dripMineActionFor(coin.valueSatoshis);
    const payoutSatoshis = dripMinePayout(coin.valueSatoshis);
    const remainderSatoshis = coin.valueSatoshis - payoutSatoshis;
    const draft = startInvitation({ templateIdentifier: dripMineTemplateIdentifier, actionIdentifier: action, network });

    // The input also carries the spent coin's value, as XO wallets write it, so the importing wallet needs no lookup.
    const dripMineInput: InvitationInputWithSpentOutputFields = {
        outpointTransactionHash: hexToBin(coin.transactionHash),
        outpointIndex: coin.outputIndex,
        inputIdentifier: 'dripMineInput',
        transactionIndex: 0,
        // The contract starts with `1 OP_CHECKSEQUENCEVERIFY`: the coin must be at least one block old.
        sequenceNumber: 1,
        valueSatoshis: coin.valueSatoshis,
    };

    draft.commit({ roleIdentifier: 'dripper' });
    const inputCommit = draft.commit({ inputs: [dripMineInput] });
    draft.commit({ variables: [{ variableIdentifier: 'dripCoinSatoshis', value: coin.valueSatoshis, roleIdentifier: 'dripper' }] });
    draft.commit({
        outputs: [
            action === 'drip'
                ? { outputIdentifier: 'dripRemainderOutput', transactionIndex: 0, valueSatoshis: remainderSatoshis, lockingBytecode: dripMineLockingBytecode }
                : { outputIdentifier: 'terminalOutput', transactionIndex: 0, valueSatoshis: 0n, lockingBytecode: TERMINAL_LOCKING_BYTECODE },
        ],
    });
    // The input's unlocking bytecode, filled into the input commit above (XO's mergesWith).
    draft.commit({ inputs: [{ mergesWith: { commitIdentifier: inputCommit, itemIndex: 0 }, unlockingBytecode: dripMineUnlockingBytecode }] });

    const finished = finishInvitation({
        draft,
        template: dripMineTemplate,
        actionIdentifier: action,
        network,
        sourceOutputs: [{ lockingBytecode: dripMineLockingBytecode, valueSatoshis: coin.valueSatoshis }],
    });

    return { ...finished, action, payoutSatoshis, remainderSatoshis };
}
