import { Flame, Hammer } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CoinToken, UnspentCoin } from '../lib/electrum';
import type { Network } from '../lib/invitation';
import {
    MAX_BURN_MESSAGE_BYTES,
    buildTokenBurnInvitation,
    burnMessageBytes,
    tokenBurnerAddress,
    tokenBurnerLockingBytecode,
    tokenBurnerTemplateIdentifier,
    type TokenBurnInvitation,
} from '../lib/token-burner';
import { AddressBar, BuildError, CoinsGate, MainnetWarning, NetworkBar, errorText, scrollIntoViewSoon, useContractCoins } from './common';
import { InvitationResult } from './InvitationResult';
import { Pill, Section, StatusMessage, formatSatoshis, inputClass, primaryButton, shortHash, smallButton } from './ui';

const PAGE_SIZE = 25;
const outpointOf = (coin: { transactionHash: string; outputIndex: number }): string => `${coin.transactionHash}:${coin.outputIndex}`;

function TokenLabel({ token }: { token: CoinToken | undefined }) {
    if (!token) {
        return <span className="text-gray-500">BCH only</span>;
    }

    return (
        <div className="space-y-1">
            {token.amount > 0n && (
                <div className="text-gray-200">
                    {token.amount.toLocaleString('en-US')} <span className="text-xs text-gray-500">fungible</span>
                </div>
            )}
            {token.nft && (
                <div className="flex flex-wrap items-center gap-1.5 text-gray-200">
                    <Pill tone="violet">NFT · {token.nft.capability}</Pill>
                    {token.nft.commitment && <span className="font-mono text-xs text-gray-500">{token.nft.commitment.length > 16 ? `${token.nft.commitment.slice(0, 16)}…` : token.nft.commitment}</span>}
                </div>
            )}
            <div className="font-mono text-xs text-gray-500" title={token.category}>
                {shortHash(token.category)}
            </div>
        </div>
    );
}

export function TokenBurnerPanel() {
    const [network, setNetwork] = useState<Network>('chipnet');
    const { coins, reload } = useContractCoins(network, tokenBurnerLockingBytecode);
    const [shown, setShown] = useState(PAGE_SIZE);
    const [selected, setSelected] = useState<Set<string>>(new Set());
    const [message, setMessage] = useState('');
    const [result, setResult] = useState<TokenBurnInvitation | undefined>();
    const [buildError, setBuildError] = useState<string | undefined>();
    const resultRef = useRef<HTMLDivElement>(null);
    const address = useMemo(() => tokenBurnerAddress(network), [network]);
    const messageBytes = burnMessageBytes(message);
    const loadedCoins = coins.status === 'loaded' ? coins.coins : [];
    const selectedCoins = loadedCoins.filter((coin) => selected.has(outpointOf(coin)));

    useEffect(() => {
        setResult(undefined);
        setBuildError(undefined);
        setShown(PAGE_SIZE);
        setSelected(new Set());
    }, [network]);

    // Drop selections that a refresh no longer lists (already burned or spent).
    useEffect(() => {
        if (coins.status === 'loaded') {
            const listed = new Set(coins.coins.map(outpointOf));

            setSelected((current) => new Set([...current].filter((outpoint) => listed.has(outpoint))));
        }
    }, [coins]);

    const toggle = (coin: UnspentCoin): void => {
        setSelected((current) => {
            const next = new Set(current);
            const outpoint = outpointOf(coin);

            if (next.has(outpoint)) {
                next.delete(outpoint);
            } else {
                next.add(outpoint);
            }

            return next;
        });
    };

    const build = (): void => {
        setBuildError(undefined);

        try {
            setResult(buildTokenBurnInvitation(network, selectedCoins, message));
            scrollIntoViewSoon(resultRef.current);
        } catch (error) {
            setResult(undefined);
            setBuildError(errorText(error));
        }
    };

    return (
        <Section
            icon={<Flame size={24} />}
            title="Token Burner"
            description={
                <>
                    Burn coins at the shared TokenBurner address: their tokens are destroyed for good and their satoshis go to the miner, in a
                    transaction whose only output is an OP_RETURN with your farewell message. Anyone can burn anything sent here. Template{' '}
                    <span className="font-mono text-gray-400" title={tokenBurnerTemplateIdentifier}>
                        {shortHash(tokenBurnerTemplateIdentifier)}
                    </span>
                    .
                </>
            }
        >
            <NetworkBar network={network} onChange={setNetwork} loading={coins.status === 'loading'} onRefresh={reload} />

            {network === 'mainnet' && (
                <MainnetWarning>
                    Burning cannot be undone: every selected coin's tokens are destroyed, including coins other people sent here. This page only builds
                    the invitation; your wallet broadcasts it, and the coins' satoshis are the fee.
                </MainnetWarning>
            )}

            <AddressBar address={address} />

            <CoinsGate coins={coins} emptyText="No coins at the TokenBurner address. Send tokens there first (the template's deposit actions in your XO wallet).">
                {(loaded) => {
                    const visible = loaded.coins.slice(0, shown);

                    return (
                        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
                            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-xs text-gray-500">
                                <span>
                                    {loaded.coins.length.toLocaleString('en-US')} coins, largest first · {selected.size} selected
                                </span>
                                <span className="flex gap-2">
                                    <button type="button" className={smallButton} onClick={() => setSelected(new Set(loaded.coins.map(outpointOf)))}>
                                        Select all
                                    </button>
                                    <button type="button" className={smallButton} onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
                                        Clear
                                    </button>
                                </span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full min-w-[640px] text-left text-sm">
                                    <thead className="text-[11px] uppercase tracking-wider text-gray-500">
                                        <tr>
                                            <th className="w-10 px-4 py-2" />
                                            <th className="px-4 py-2 font-semibold">Coin</th>
                                            <th className="px-4 py-2 font-semibold">Tokens</th>
                                            <th className="px-4 py-2 font-semibold">Satoshis</th>
                                            <th className="px-4 py-2 font-semibold">Confirmations</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {visible.map((coin) => {
                                            const outpoint = outpointOf(coin);
                                            const confirmations = coin.height > 0 ? loaded.tipHeight - coin.height + 1 : 0;

                                            return (
                                                <tr
                                                    key={outpoint}
                                                    className={`cursor-pointer border-t border-white/[0.04] ${selected.has(outpoint) ? 'bg-orange-500/[0.06]' : 'hover:bg-white/[0.02]'}`}
                                                    onClick={() => toggle(coin)}
                                                >
                                                    <td className="px-4 py-2.5">
                                                        <input
                                                            type="checkbox"
                                                            className="h-4 w-4 accent-orange-500"
                                                            checked={selected.has(outpoint)}
                                                            onChange={() => toggle(coin)}
                                                            onClick={(event) => event.stopPropagation()}
                                                            aria-label={`Select ${outpoint}`}
                                                        />
                                                    </td>
                                                    <td className="px-4 py-2.5 font-mono text-xs text-gray-300" title={outpoint}>
                                                        {shortHash(coin.transactionHash)}:{coin.outputIndex}
                                                    </td>
                                                    <td className="px-4 py-2.5">
                                                        <TokenLabel token={coin.token} />
                                                    </td>
                                                    <td className="px-4 py-2.5 text-gray-300">{formatSatoshis(coin.valueSatoshis)}</td>
                                                    <td className="px-4 py-2.5 text-gray-400">{confirmations > 0 ? confirmations.toLocaleString('en-US') : 'unconfirmed'}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            {visible.length < loaded.coins.length && (
                                <div className="border-t border-white/[0.06] p-3 text-center">
                                    <button type="button" className={smallButton} onClick={() => setShown((count) => count + PAGE_SIZE)}>
                                        Show {Math.min(PAGE_SIZE, loaded.coins.length - visible.length)} more
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                }}
            </CoinsGate>

            <div className="grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                <label className="block text-sm">
                    <span className="mb-1.5 flex justify-between text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                        <span>Farewell message (optional)</span>
                        <span className={messageBytes > MAX_BURN_MESSAGE_BYTES ? 'text-rose-400' : ''}>
                            {messageBytes} / {MAX_BURN_MESSAGE_BYTES} bytes
                        </span>
                    </span>
                    <input className={inputClass} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Goodbye, tokens" />
                </label>
                <button type="button" className={primaryButton} onClick={build} disabled={selectedCoins.length === 0 || messageBytes > MAX_BURN_MESSAGE_BYTES}>
                    <Flame size={16} /> Burn {selectedCoins.length || ''} {selectedCoins.length === 1 ? 'coin' : 'coins'}
                </button>
            </div>

            {selectedCoins.length > 0 && (
                <StatusMessage type="info">
                    The burn spends {selectedCoins.length} {selectedCoins.length === 1 ? 'coin' : 'coins'}; their{' '}
                    {formatSatoshis(selectedCoins.reduce((sum, coin) => sum + coin.valueSatoshis, 0n))} become the fee.
                </StatusMessage>
            )}

            <BuildError message={buildError} />

            <div ref={resultRef}>
                {result && (
                    <InvitationResult
                        result={result}
                        network={network}
                        action="burn"
                        actionTone="rose"
                        details={[
                            { label: 'Coins burned', value: result.coinCount.toLocaleString('en-US') },
                            { label: 'Fee to the miner', value: formatSatoshis(result.feeSatoshis) },
                            {
                                label: 'Tokens destroyed',
                                value:
                                    [
                                        ...result.fungibleTokens.map((token) => `${token.amount.toLocaleString('en-US')} of ${shortHash(token.category)}`),
                                        ...(result.nftCount > 0 ? [`${result.nftCount} NFT${result.nftCount === 1 ? '' : 's'}`] : []),
                                    ].join(' · ') || 'none (BCH only)',
                            },
                            { label: 'Farewell message', value: message || <span className="text-gray-500">(empty)</span> },
                        ]}
                        note="Import this in your XO wallet and run the action. It already holds every burner coin, each input's unlocking bytecode and the OP_RETURN, so your wallet adds no coins and no signatures; the commits are signed by a throwaway key made for this invitation."
                    />
                )}
            </div>
        </Section>
    );
}
