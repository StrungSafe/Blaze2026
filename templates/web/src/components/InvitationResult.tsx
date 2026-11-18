import { ChevronDown, FileJson, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { DripMineInvitation } from '../lib/drip-mine';
import type { Network } from '../lib/invitation';
import { CopyButton, Pill, StatusMessage, formatSatoshis, primaryButton, shortHash, smallButton } from './ui';

const prettyJson = (serialized: string): string => {
    try {
        return JSON.stringify(JSON.parse(serialized), null, 2);
    } catch {
        return serialized;
    }
};

const timeLeft = (date: Date): string => {
    const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60_000));

    return minutes >= 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes} min`;
};

export function InvitationResult({ result, network }: { result: DripMineInvitation; network: Network }) {
    const [showTransaction, setShowTransaction] = useState(false);
    const preview = useMemo(() => prettyJson(result.serializedInvitation), [result.serializedInvitation]);
    const [input] = result.transaction.inputs;

    return (
        <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="emerald">
                        <ShieldCheck size={12} /> XO valid · VM ✓
                    </Pill>
                    <Pill tone={result.action === 'drip' ? 'orange' : 'violet'}>{result.action}</Pill>
                    <Pill tone={network === 'mainnet' ? 'rose' : 'gray'}>{network}</Pill>
                </div>
                <CopyButton text={result.serializedInvitation} label="Copy invitation" className={primaryButton} iconSize={16} />
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <Detail label="Invitation">
                    <span className="font-mono">{result.invitationIdentifier}</span>
                </Detail>
                <Detail label="Transaction id">
                    <span className="font-mono" title={result.transactionHash}>
                        {shortHash(result.transactionHash)}
                    </span>
                </Detail>
                <Detail label="Payout (fee to the miner)">{formatSatoshis(result.payoutSatoshis)}</Detail>
                <Detail label={result.action === 'drip' ? 'Back to the Drip Mine' : 'Output'}>
                    {result.action === 'drip' ? formatSatoshis(result.remainderSatoshis) : '0-sat OP_RETURN'}
                </Detail>
                <Detail label="Size">{result.transactionByteLength} bytes</Detail>
                <Detail label="Commits expire">
                    {result.expiresAt.toLocaleString()} <span className="text-gray-500">(in {timeLeft(result.expiresAt)})</span>
                </Detail>
                <Detail label="Unlocking bytecode">
                    <span className="font-mono text-gray-400">{input ? `${input.unlockingBytecode.length} bytes (redeem script push)` : '—'}</span>
                </Detail>
            </dl>

            <StatusMessage type="info">
                Import this in your XO wallet and run the action. It already holds the Drip Mine coin, its unlocking bytecode and the output, so your
                wallet adds no coins and no signatures; the commits are signed by a throwaway key made for this invitation.
            </StatusMessage>

            <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
                    <FileJson size={14} /> Invitation JSON
                </div>
                <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-[#080B10] p-4 text-xs leading-relaxed text-gray-300">{preview}</pre>
            </div>

            <div>
                <button type="button" className={smallButton} onClick={() => setShowTransaction((shown) => !shown)}>
                    <ChevronDown size={14} className={`transition-transform ${showTransaction ? 'rotate-180' : ''}`} />
                    Raw transaction (for checking)
                </button>
                {showTransaction && (
                    <div className="mt-3 space-y-2">
                        <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-xl border border-white/10 bg-[#080B10] p-4 font-mono text-xs text-gray-400">
                            {result.serializedTransaction}
                        </pre>
                        <CopyButton text={result.serializedTransaction} label="Copy transaction hex" />
                    </div>
                )}
            </div>
        </div>
    );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{label}</dt>
            <dd className="mt-1 truncate text-gray-200">{children}</dd>
        </div>
    );
}
