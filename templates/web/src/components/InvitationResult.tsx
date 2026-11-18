import { ChevronDown, FileJson, ShieldCheck } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { FinishedInvitation, Network } from '../lib/invitation';
import { CopyButton, Pill, StatusMessage, primaryButton, shortHash, smallButton } from './ui';

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

export interface ResultDetail {
    label: string;
    value: ReactNode;
}

/** A built invitation: the Copy button, the template-specific details, the JSON and the raw transaction. */
export function InvitationResult({
    result,
    network,
    action,
    actionTone = 'orange',
    details,
    note,
}: {
    result: FinishedInvitation;
    network: Network;
    action: string;
    actionTone?: 'orange' | 'violet' | 'rose';
    details: ResultDetail[];
    note: ReactNode;
}) {
    const [showTransaction, setShowTransaction] = useState(false);
    const preview = useMemo(() => prettyJson(result.serializedInvitation), [result.serializedInvitation]);
    const allDetails: ResultDetail[] = [
        { label: 'Invitation', value: <span className="font-mono">{result.invitationIdentifier}</span> },
        {
            label: 'Transaction id',
            value: (
                <span className="font-mono" title={result.transactionHash}>
                    {shortHash(result.transactionHash)}
                </span>
            ),
        },
        ...details,
        { label: 'Size', value: `${result.transactionByteLength.toLocaleString('en-US')} bytes` },
        {
            label: 'Commits expire',
            value: (
                <>
                    {result.expiresAt.toLocaleString()} <span className="text-gray-500">(in {timeLeft(result.expiresAt)})</span>
                </>
            ),
        },
    ];

    return (
        <div className="space-y-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.03] p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                    <Pill tone="emerald">
                        <ShieldCheck size={12} /> XO valid · VM ✓
                    </Pill>
                    <Pill tone={actionTone}>{action}</Pill>
                    <Pill tone={network === 'mainnet' ? 'rose' : 'gray'}>{network}</Pill>
                </div>
                <CopyButton text={result.serializedInvitation} label="Copy invitation" className={primaryButton} iconSize={16} />
            </div>

            <dl className="grid gap-3 text-sm sm:grid-cols-2">
                {allDetails.map((detail) => (
                    <div key={detail.label} className="min-w-0 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{detail.label}</dt>
                        <dd className="mt-1 truncate text-gray-200">{detail.value}</dd>
                    </div>
                ))}
            </dl>

            <StatusMessage type="info">{note}</StatusMessage>

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
