/**
 * RevenueSplit.cash through the CashScript SDK (MockNetworkProvider + TransactionBuilder.debug(), which runs the
 * transaction in Libauth's VM and throws on a failed require).
 */
import { binToHex } from '@bitauth/libauth';
import {
    Contract,
    FailedTransactionError,
    MockNetworkProvider,
    SignatureTemplate,
    TransactionBuilder,
    randomUtxo,
    type SpendableUtxo,
} from 'cashscript';
import { describe, expect, it } from 'vitest';
import artifactJson from '../artifact/RevenueSplit.json' with { type: 'json' };
import { toArtifact } from '../../shared/cashscript.js';

const artifact = toArtifact(artifactJson);
import { p2pkhLockingBytecode, testKey } from '../../shared/vm.js';

const artist = testKey(1);
const collaborator = testKey(2);
const platform = testKey(3);
const trigger = testKey(4);
const triggerSigner = new SignatureTemplate(trigger.privateKey);
const triggerLock = p2pkhLockingBytecode(trigger.publicKeyHash);

const ARTIST_BASIS_POINTS = 6000n;
const COLLABORATOR_BASIS_POINTS = 2500n;

const provider = new MockNetworkProvider();

function makeContract(artistBasisPoints = ARTIST_BASIS_POINTS, collaboratorBasisPoints = COLLABORATOR_BASIS_POINTS): Contract {
    return new Contract(
        artifact,
        [artist.publicKeyHash, collaborator.publicKeyHash, platform.publicKeyHash, artistBasisPoints, collaboratorBasisPoints],
        { provider },
    );
}

/** The three shares the contract demands for a coin of `total` satoshis. */
function shares(total: bigint, artistBasisPoints = ARTIST_BASIS_POINTS, collaboratorBasisPoints = COLLABORATOR_BASIS_POINTS): [bigint, bigint, bigint] {
    const artistAmount = (total * artistBasisPoints) / 10000n;
    const collaboratorAmount = (total * collaboratorBasisPoints) / 10000n;

    return [artistAmount, collaboratorAmount, total - artistAmount - collaboratorAmount];
}

function shareOutputs(total: bigint): { to: Uint8Array; amount: bigint }[] {
    const [artistAmount, collaboratorAmount, platformAmount] = shares(total);

    return [
        { to: p2pkhLockingBytecode(artist.publicKeyHash), amount: artistAmount },
        { to: p2pkhLockingBytecode(collaborator.publicKeyHash), amount: collaboratorAmount },
        { to: p2pkhLockingBytecode(platform.publicKeyHash), amount: platformAmount },
    ];
}

/** A coin of the trigger's own, used to pay the miner fee. */
function feeCoin(satoshis = 10_000n): SpendableUtxo {
    return randomUtxo({ satoshis, lockingBytecode: binToHex(triggerLock) });
}

/** A coin locked to the split contract. */
function splitUtxo(contract: Contract, satoshis: bigint): SpendableUtxo {
    return randomUtxo({ satoshis, lockingBytecode: contract.lockingBytecode });
}

// Every rejection must come from evaluating the transaction (a failed require or a script error), never from a
// mistake in building it, or a broken fixture would make these tests pass.
const REJECTED = FailedTransactionError;

describe('RevenueSplit.cash', () => {
    const contract = makeContract();
    const splitCoin = splitUtxo(contract, 100_000n);

    it('pays the whole coin out at the split, with the trigger paying the fee and taking change', () => {
        const builder = new TransactionBuilder({ provider })
            .addInput(splitCoin, contract.unlock.Payout())
            .addInput(feeCoin(), triggerSigner.unlockP2PKH())
            .addOutputs(shareOutputs(splitCoin.satoshis))
            .addOutput({ to: triggerLock, amount: 9_500n });

        expect(() => builder.debug()).not.toThrow();
        expect(shares(100_000n)).toEqual([60_000n, 25_000n, 15_000n]);
    });

    it('gives the rounding remainder to the platform', () => {
        const coin = splitUtxo(contract, 10_001n);
        const [artistAmount, collaboratorAmount, platformAmount] = shares(coin.satoshis);

        expect(artistAmount + collaboratorAmount + platformAmount).toBe(10_001n);
        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(coin, contract.unlock.Payout())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addOutputs(shareOutputs(coin.satoshis))
                .addOutput({ to: triggerLock, amount: 9_500n })
                .debug(),
        ).not.toThrow();
    });

    it('rejects a share that is one satoshi short', () => {
        const outputs = shareOutputs(splitCoin.satoshis);
        outputs[0] = { ...outputs[0], amount: outputs[0].amount - 1n };

        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(splitCoin, contract.unlock.Payout())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addOutputs(outputs)
                .addOutput({ to: triggerLock, amount: 9_500n })
                .debug(),
        ).toThrow(REJECTED);
    });

    it('rejects shares sent to the wrong recipients (artist and collaborator swapped)', () => {
        const [artistOutput, collaboratorOutput, platformOutput] = shareOutputs(splitCoin.satoshis);

        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(splitCoin, contract.unlock.Payout())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addOutputs([
                    { to: collaboratorOutput.to, amount: artistOutput.amount },
                    { to: artistOutput.to, amount: collaboratorOutput.amount },
                    platformOutput,
                ])
                .addOutput({ to: triggerLock, amount: 9_500n })
                .debug(),
        ).toThrow(REJECTED);
    });

    it('rejects a payout that leaves out the platform share', () => {
        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(splitCoin, contract.unlock.Payout())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addOutputs(shareOutputs(splitCoin.satoshis).slice(0, 2))
                .debug(),
        ).toThrow(REJECTED);
    });

    it('rejects a trigger who takes part of the split as a fee', () => {
        const outputs = shareOutputs(splitCoin.satoshis);
        outputs[2] = { ...outputs[2], amount: outputs[2].amount - 500n };

        expect(() =>
            new TransactionBuilder({ provider }).addInput(splitCoin, contract.unlock.Payout()).addOutputs(outputs).debug(),
        ).toThrow(REJECTED);
    });

    it('finds its shares relative to its own input index, so it can sit behind other inputs', () => {
        // Split coin at input 1, so its shares are outputs 1, 2 and 3. Output 0 is unrelated (the trigger's change).
        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addInput(splitCoin, contract.unlock.Payout())
                .addOutput({ to: triggerLock, amount: 9_500n })
                .addOutputs(shareOutputs(splitCoin.satoshis))
                .debug(),
        ).not.toThrow();
    });

    it('batches two split coins when their share windows do not overlap (inputs 0 and 3)', () => {
        const secondCoin = splitUtxo(contract, 50_000n);

        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(splitCoin, contract.unlock.Payout())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addInput(feeCoin(), triggerSigner.unlockP2PKH())
                .addInput(secondCoin, contract.unlock.Payout())
                .addOutputs(shareOutputs(splitCoin.satoshis))
                .addOutputs(shareOutputs(secondCoin.satoshis))
                .addOutput({ to: triggerLock, amount: 19_000n })
                .debug(),
        ).not.toThrow();
    });

    it('cannot pay two coins of the same split with one shared set of outputs (inputs 0 and 1)', () => {
        // Coin 0 needs the collaborator at output 1; coin 1 needs the artist there. One output cannot be both, so a
        // trigger cannot pay one coin's shares, count them for both coins and keep the second coin as change.
        const outputs = shareOutputs(splitCoin.satoshis);

        expect(() =>
            new TransactionBuilder({ provider })
                .addInput(splitCoin, contract.unlock.Payout())
                .addInput(splitUtxo(contract, splitCoin.satoshis), contract.unlock.Payout())
                .addOutputs(outputs)
                .addOutput(outputs[2])
                .addOutput({ to: triggerLock, amount: 84_000n })
                .debug(),
        ).toThrow(REJECTED);
    });
});
