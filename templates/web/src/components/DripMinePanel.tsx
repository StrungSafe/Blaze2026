import { Droplets, Hammer, Loader2, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
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
import { listUnspentCoins, type UnspentCoin } from '../lib/electrum';
import type { Network } from '../lib/invitation';
import { InvitationResult } from './InvitationResult';
import { CopyButton, Pill, Section, StatusMessage, formatBch, formatSatoshis, inputClass, secondaryButton, shortHash, smallButton } from './ui';

const PAGE_SIZE = 25;

type CoinsState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; message: string } | { status: 'loaded'; coins: UnspentCoin[]; tipHeight: number };

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function DripMinePanel() {
    const [network, setNetwork] = useState<Network>('chipnet');
    const [coins, setCoins] = useState<CoinsState>({ status: 'idle' });
    const [shown, setShown] = useState(PAGE_SIZE);
    const [result, setResult] = useState<DripMineInvitation | undefined>();
    const [buildError, setBuildError] = useState<string | undefined>();
    const [manualOutpoint, setManualOutpoint] = useState('');
    const [manualValue, setManualValue] = useState('');
    const resultRef = useRef<HTMLDivElement>(null);
    const address = useMemo(() => dripMineAddress(network), [network]);

    const loadCoins = useCallback(async (selected: Network) => {
        setCoins({ status: 'loading' });

        try {
            const loaded = await listUnspentCoins(selected, dripMineLockingBytecode);

            setCoins({ status: 'loaded', ...loaded });
        } catch (error) {
            setCoins({ status: 'error', message: errorText(error) });
        }
    }, []);

    useEffect(() => {
        setResult(undefined);
        setBuildError(undefined);
        setShown(PAGE_SIZE);
        void loadCoins(network);
    }, [network, loadCoins]);

    const build = (coin: DripMineCoin): void => {
        setBuildError(undefined);

        try {
            setResult(buildDripMineInvitation(network, coin));
            window.setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
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
            <div className="flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Network">
                    {(['chipnet', 'mainnet'] as const).map((option) => (
                        <button
                            key={option}
                            type="button"
                            role="tab"
                            aria-selected={network === option}
                            onClick={() => setNetwork(option)}
                            className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                                network === option ? (option === 'mainnet' ? 'bg-rose-500/20 text-rose-200' : 'bg-orange-500 text-white') : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            {option}
                        </button>
                    ))}
                </div>
                <button type="button" className={smallButton} onClick={() => void loadCoins(network)} disabled={coins.status === 'loading'}>
                    <RefreshCw size={14} className={coins.status === 'loading' ? 'animate-spin' : ''} /> Refresh coins
                </button>
            </div>

            {network === 'mainnet' && (
                <StatusMessage type="warning">
                    <span className="inline-flex items-center gap-2 font-semibold">
                        <TriangleAlert size={16} /> Mainnet: real BCH.
                    </span>{' '}
                    This page only builds the invitation and never broadcasts. A drip costs your wallet nothing: the payout comes out of the Drip Mine coin.
                </StatusMessage>
            )}

            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Address</span>
                <span className="min-w-0 break-all font-mono text-gray-300">{address}</span>
                <CopyButton text={address} label="Copy" />
            </div>

            <CoinTable coins={coins} shown={shown} onShowMore={() => setShown((count) => count + PAGE_SIZE)} onBuild={build} />

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

            {buildError && (
                <StatusMessage type="error">
                    <pre className="whitespace-pre-wrap font-[inherit]">{buildError}</pre>
                </StatusMessage>
            )}

            <div ref={resultRef}>{result && <InvitationResult result={result} network={network} />}</div>
        </Section>
    );
}

function CoinTable({ coins, shown, onShowMore, onBuild }: { coins: CoinsState; shown: number; onShowMore: () => void; onBuild: (coin: DripMineCoin) => void }) {
    if (coins.status === 'idle' || coins.status === 'loading') {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin text-orange-400" /> Looking up Drip Mine coins…
            </div>
        );
    }

    if (coins.status === 'error') {
        return <StatusMessage type="error">Could not list coins: {coins.message}</StatusMessage>;
    }

    if (coins.coins.length === 0) {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-gray-400">
                <Search size={16} /> No coins at the Drip Mine address.
            </div>
        );
    }

    const visible = coins.coins.slice(0, shown);

    return (
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
                <span>
                    {coins.coins.length.toLocaleString('en-US')} coins, largest first · tip height {coins.tipHeight.toLocaleString('en-US')}
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
                            const confirmations = coin.height > 0 ? coins.tipHeight - coin.height + 1 : 0;
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
            {visible.length < coins.coins.length && (
                <div className="border-t border-white/[0.06] p-3 text-center">
                    <button type="button" className={smallButton} onClick={onShowMore}>
                        Show {Math.min(PAGE_SIZE, coins.coins.length - visible.length)} more
                    </button>
                </div>
            )}
        </div>
    );
}
