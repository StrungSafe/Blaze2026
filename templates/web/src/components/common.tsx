/** Pieces every contract panel shares: the network toggle, the contract address, coin loading and messages. */
import { Loader2, RefreshCw, Search, TriangleAlert } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { listUnspentCoins, type UnspentCoinList } from '../lib/electrum';
import type { Network } from '../lib/invitation';
import { CopyButton, StatusMessage, smallButton } from './ui';

export type CoinsState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'error'; message: string }
    | ({ status: 'loaded' } & UnspentCoinList);

export const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Unspent coins at a contract's locking bytecode on `network`, reloaded when the network changes. */
export function useContractCoins(network: Network, lockingBytecode: Uint8Array): { coins: CoinsState; reload: () => void } {
    const [coins, setCoins] = useState<CoinsState>({ status: 'idle' });

    const load = useCallback(async () => {
        setCoins({ status: 'loading' });

        try {
            setCoins({ status: 'loaded', ...(await listUnspentCoins(network, lockingBytecode)) });
        } catch (error) {
            setCoins({ status: 'error', message: errorText(error) });
        }
    }, [network, lockingBytecode]);

    useEffect(() => {
        void load();
    }, [load]);

    return { coins, reload: () => void load() };
}

export function NetworkBar({ network, onChange, loading, onRefresh }: { network: Network; onChange: (network: Network) => void; loading: boolean; onRefresh: () => void }) {
    return (
        <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-white/10 bg-white/[0.03] p-1" role="tablist" aria-label="Network">
                {(['chipnet', 'mainnet'] as const).map((option) => (
                    <button
                        key={option}
                        type="button"
                        role="tab"
                        aria-selected={network === option}
                        onClick={() => onChange(option)}
                        className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition ${
                            network === option ? (option === 'mainnet' ? 'bg-rose-500/20 text-rose-200' : 'bg-orange-500 text-white') : 'text-gray-400 hover:text-white'
                        }`}
                    >
                        {option}
                    </button>
                ))}
            </div>
            <button type="button" className={smallButton} onClick={onRefresh} disabled={loading}>
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh coins
            </button>
        </div>
    );
}

export function MainnetWarning({ children }: { children: ReactNode }) {
    return (
        <StatusMessage type="warning">
            <span className="inline-flex items-center gap-2 font-semibold">
                <TriangleAlert size={16} /> Mainnet: real BCH.
            </span>{' '}
            {children}
        </StatusMessage>
    );
}

export function AddressBar({ address }: { address: string }) {
    return (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">Address</span>
            <span className="min-w-0 break-all font-mono text-gray-300">{address}</span>
            <CopyButton text={address} label="Copy" />
        </div>
    );
}

/** Loading, error and empty states for a coin list; renders `children` once coins are loaded. */
export function CoinsGate({ coins, emptyText, children }: { coins: CoinsState; emptyText: string; children: (loaded: Extract<CoinsState, { status: 'loaded' }>) => ReactNode }) {
    if (coins.status === 'idle' || coins.status === 'loading') {
        return (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-gray-400">
                <Loader2 size={16} className="animate-spin text-orange-400" /> Looking up coins…
            </div>
        );
    }

    if (coins.status === 'error') {
        return <StatusMessage type="error">Could not list coins: {coins.message}</StatusMessage>;
    }

    const tokensWarning = coins.tokensMayBeHidden && (
        <StatusMessage type="warning">This Electrum server refused the token filter, so coins that carry tokens may be missing from this list.</StatusMessage>
    );

    if (coins.coins.length === 0) {
        return (
            <>
                {tokensWarning}
                <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-6 text-sm text-gray-400">
                    <Search size={16} /> {emptyText}
                </div>
            </>
        );
    }

    return (
        <>
            {tokensWarning}
            {children(coins)}
        </>
    );
}

export function BuildError({ message }: { message: string | undefined }) {
    return message ? (
        <StatusMessage type="error">
            <pre className="whitespace-pre-wrap font-[inherit]">{message}</pre>
        </StatusMessage>
    ) : null;
}

export const scrollIntoViewSoon = (element: HTMLElement | null): void => {
    window.setTimeout(() => element?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
};
