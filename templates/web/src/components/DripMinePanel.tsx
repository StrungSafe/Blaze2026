import { Droplets, Hammer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import {
    TERMINATE_AT_OR_BELOW,
    buildDripMineInvitation,
    dripMineActionFor,
    dripMineAddress,
    dripMineLockingBytecode,
    dripMinePayout,
    dripMineTemplateIdentifier,
    type DripMineCoin,
    type DripMineInvitation,
} from '../lib/drip-mine';
import type { UnspentCoin } from '../lib/electrum';
import type { Network } from '../lib/invitation';
import { AddressBar, BuildError, CoinsGate, MainnetWarning, NetworkBar, errorText, scrollIntoViewSoon, useContractCoins } from './common';
import { InvitationResult } from './InvitationResult';
import { Pill, Section, formatBch, formatSatoshis, inputClass, secondaryButton, shortHash, smallButton } from './ui';

const PAGE_SIZE = 25;

export function DripMinePanel() {
    const [network, setNetwork] = useState<Network>('chipnet');
    const { coins, reload } = useContractCoins(network, dripMineLockingBytecode);
    const [shown, setShown] = useState(PAGE_SIZE);
    const [result, setResult] = useState<DripMineInvitation | undefined>();
    const [buildError, setBuildError] = useState<string | undefined>();
    const [manualOutpoint, setManualOutpoint] = useState('');
    const [manualValue, setManualValue] = useState('');
    const resultRef = useRef<HTMLDivElement>(null);
    const address = useMemo(() => dripMineAddress(network), [network]);

    useEffect(() => {
        setResult(undefined);
        setBuildError(undefined);
        setShown(PAGE_SIZE);
    }, [network]);

    const build = (coin: DripMineCoin): void => {
        setBuildError(undefined);

        try {
            setResult(buildDripMineInvitation(network, coin));
            scrollIntoViewSoon(resultRef.current);
        } catch (error) {
            setResult(undefined);
            setBuildError(errorText(error));
        }
    };

    const buildManual = (event: FormEvent): void => {
        event.preventDefault();
        const match = /^\s*([0-9a-fA-F]{64}):(\d+)\s*$/.exec(manualOutpoint);
        const value = manualValue.trim();

        if (!match || !/^\d+$/.test(value)) {
            setResult(undefined);
            setBuildError('Enter the coin as <txid>:<output index> and its value in satoshis.');
            return;
        }

        build({ transactionHash: match[1]!.toLowerCase(), outputIndex: Number(match[2]), valueSatoshis: BigInt(value) });
    };

    return (
        <Section
            icon={<Droplets size={24} />}
            title="Drip Mine"
            description={
                <>
                    Release the payout of one Drip Mine coin to miners. Pick a coin at least one block old: coins over {formatSatoshis(TERMINATE_AT_OR_BELOW)} drip
                    (the rest goes back to the Drip Mine), smaller ones terminate (paid out whole). Template{' '}
                    <span className="font-mono text-gray-400" title={dripMineTemplateIdentifier}>
                        {shortHash(dripMineTemplateIdentifier)}
                    </span>
                    .
                </>
            }
        >
            <NetworkBar network={network} onChange={setNetwork} loading={coins.status === 'loading'} onRefresh={reload} />

            {network === 'mainnet' && <MainnetWarning>This page only builds the invitation and never broadcasts. A drip costs your wallet nothing: the payout comes out of the Drip Mine coin.</MainnetWarning>}

            <AddressBar address={address} />

            <CoinsGate coins={coins} emptyText="No coins at the Drip Mine address.">
                {(loaded) => <CoinTable coins={loaded.coins} tipHeight={loaded.tipHeight} shown={shown} onShowMore={() => setShown((count) => count + PAGE_SIZE)} onBuild={build} />}
            </CoinsGate>

            <form onSubmit={buildManual} className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-[1fr_12rem_auto] sm:items-end">
                <label className="block text-sm">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Or enter a coin: txid:index</span>
                    <input className={`${inputClass} font-mono`} value={manualOutpoint} onChange={(event) => setManualOutpoint(event.target.value)} placeholder="100d9a91…98d9:0" spellCheck={false} />
                </label>
                <label className="block text-sm">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-gray-500">Value (sats)</span>
                    <input className={`${inputClass} font-mono`} value={manualValue} onChange={(event) => setManualValue(event.target.value)} placeholder="672684" inputMode="numeric" />
                </label>
                <button type="submit" className={secondaryButton}>
                    <Hammer size={16} /> Build
                </button>
            </form>

            <BuildError message={buildError} />

            <div ref={resultRef}>
                {result && (
                    <InvitationResult
                        result={result}
                        network={network}
                        action={result.action}
                        actionTone={result.action === 'drip' ? 'orange' : 'violet'}
                        details={[
                            { label: 'Payout (fee to the miner)', value: formatSatoshis(result.payoutSatoshis) },
                            { label: result.action === 'drip' ? 'Back to the Drip Mine' : 'Output', value: result.action === 'drip' ? formatSatoshis(result.remainderSatoshis) : '0-sat OP_RETURN' },
                            { label: 'Unlocking bytecode', value: <span className="font-mono text-gray-400">{result.transaction.inputs[0]?.unlockingBytecode.length ?? 0} bytes (redeem script push)</span> },
                        ]}
                        note="Import this in your XO wallet and run the action. It already holds the Drip Mine coin, its unlocking bytecode and the output, so your wallet adds no coins and no signatures; the commits are signed by a throwaway key made for this invitation."
                    />
                )}
            </div>
        </Section>
    );
}

function CoinTable({ coins, tipHeight, shown, onShowMore, onBuild }: { coins: UnspentCoin[]; tipHeight: number; shown: number; onShowMore: () => void; onBuild: (coin: DripMineCoin) => void }) {
    const visible = coins.slice(0, shown);

    return (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
                <span>
                    {coins.length.toLocaleString('en-US')} coins, largest first · tip height {tipHeight.toLocaleString('en-US')}
                </span>
                <span>Showing {visible.length}</span>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                    <thead className="text-[11px] uppercase tracking-wider text-gray-500">
                        <tr>
                            <th className="px-4 py-2 font-semibold">Coin</th>
                            <th className="px-4 py-2 font-semibold">Value</th>
                            <th className="px-4 py-2 font-semibold">Confirmations</th>
                            <th className="px-4 py-2 font-semibold">Action</th>
                            <th className="px-4 py-2 font-semibold">Payout</th>
                            <th className="px-4 py-2" />
                        </tr>
                    </thead>
                    <tbody>
                        {visible.map((coin) => {
                            const confirmations = coin.height > 0 ? tipHeight - coin.height + 1 : 0;
                            const action = dripMineActionFor(coin.valueSatoshis);
                            const blocked = coin.hasTokens ? 'Carries tokens' : confirmations < 1 ? 'Unconfirmed' : undefined;

                            return (
                                <tr key={`${coin.transactionHash}:${coin.outputIndex}`} className="border-t border-white/[0.04] hover:bg-white/[0.02]">
                                    <td className="px-4 py-2.5 font-mono text-xs text-gray-300" title={`${coin.transactionHash}:${coin.outputIndex}`}>
                                        {shortHash(coin.transactionHash)}:{coin.outputIndex}
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-200">
                                        {formatBch(coin.valueSatoshis)}
                                        <div className="text-xs text-gray-500">{formatSatoshis(coin.valueSatoshis)}</div>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-400">{confirmations > 0 ? confirmations.toLocaleString('en-US') : '—'}</td>
                                    <td className="px-4 py-2.5">
                                        <Pill tone={action === 'drip' ? 'orange' : 'violet'}>{action}</Pill>
                                    </td>
                                    <td className="px-4 py-2.5 text-gray-300">{formatSatoshis(dripMinePayout(coin.valueSatoshis))}</td>
                                    <td className="px-4 py-2.5 text-right">
                                        <button
                                            type="button"
                                            className={smallButton}
                                            disabled={blocked !== undefined}
                                            title={blocked}
                                            onClick={() => onBuild({ transactionHash: coin.transactionHash, outputIndex: coin.outputIndex, valueSatoshis: coin.valueSatoshis })}
                                        >
                                            <Hammer size={13} /> {blocked ?? 'Build'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
            {visible.length < coins.length && (
                <div className="border-t border-white/[0.06] p-3 text-center">
                    <button type="button" className={smallButton} onClick={onShowMore}>
                        Show {Math.min(PAGE_SIZE, coins.length - visible.length)} more
                    </button>
                </div>
            )}
        </div>
    );
}
