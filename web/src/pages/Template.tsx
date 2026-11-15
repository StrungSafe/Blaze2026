import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type Decision, type Detail } from '../api';
import { BadgePill } from '../components';

const statusStyle = { pass: 'text-emerald-700', warn: 'text-amber-700', fail: 'text-red-700', skipped: 'text-slate-500' } as const;

export function TemplatePage() {
    const { identifier = '' } = useParams();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [error, setError] = useState('');
    const [reason, setReason] = useState('');
    const [flagMessage, setFlagMessage] = useState('');
    const [minBadge, setMinBadge] = useState('auto-checked');
    const [blockFlagged, setBlockFlagged] = useState(true);
    const [decision, setDecision] = useState<Decision | null>(null);

    const load = useCallback(() => {
        api<Detail>(`/api/templates/${identifier}`).then((d) => { setDetail(d); setError(''); }).catch((e: Error) => setError(e.message));
    }, [identifier]);

    useEffect(load, [load]);

    useEffect(() => {
        api<Decision>('/api/policy/evaluate', { method: 'POST', body: { identifier, policy: { minBadge, blockFlagged } } }).then(setDecision).catch(() => setDecision(null));
    }, [identifier, minBadge, blockFlagged, detail?.badge, detail?.openFlags]);

    async function submitFlag() {
        try {
            await api(`/api/templates/${identifier}/flags`, { method: 'POST', body: { reason } });
            setReason('');
            setFlagMessage('Flag recorded. Thank you.');
            load();
        } catch (e) {
            setFlagMessage((e as Error).message);
        }
    }

    if (error) return <p className="text-red-700 mt-6">{error}</p>;
    if (!detail) return <p className="mt-6">Loading…</p>;

    if (detail.removed) {
        return (
            <div className="mt-6 rounded border border-red-300 bg-red-50 p-4">
                <h1 className="text-xl font-bold">{detail.name} was removed</h1>
                <p className="mt-1">Reason: {detail.removedReason}</p>
                <p className="text-xs font-mono mt-2 break-all">{detail.identifier}</p>
            </div>
        );
    }

    return (
        <div className="mt-4">
            <div className="flex items-center gap-2 flex-wrap"><h1 className="text-2xl font-bold">{detail.name}</h1><BadgePill badge={detail.badge} /></div>
            <p className="text-slate-600 mt-1">{detail.description}</p>
            <p className="text-xs font-mono break-all mt-2 text-slate-500" data-testid="identifier">{detail.identifier}</p>

            <h2 className="text-lg font-semibold mt-6">Automated checks</h2>
            <p className="text-sm text-slate-500">Passing checks are not a safety claim. They only say nothing obviously wrong was found.</p>
            <ul className="mt-2 space-y-2">
                {detail.auditReport?.results.map((r) => (
                    <li key={r.id} className="rounded border bg-white p-3">
                        <span className={`font-medium ${statusStyle[r.status]}`}>{r.status.toUpperCase()}</span> {r.title}: {r.message}
                        {r.details?.length ? <ul className="text-xs text-slate-500 mt-1 list-disc ml-5">{r.details.map((d) => <li key={d}>{d}</li>)}</ul> : null}
                    </li>
                )) ?? <li>No report yet.</li>}
            </ul>

            <h2 className="text-lg font-semibold mt-6">What it does</h2>
            <p className="text-sm">Roles: {detail.roles.map((r) => r.name).join(', ') || 'none'}</p>
            <ul className="text-sm list-disc ml-5">{detail.actions.map((a) => <li key={a.id}><b>{a.name}</b>: {a.description}</li>)}</ul>

            <h2 className="text-lg font-semibold mt-6">Moderator reviews</h2>
            {detail.reviews.length === 0 ? <p className="text-sm text-slate-500">No reviews yet.</p> : (
                <ul className="space-y-2">{detail.reviews.map((r) => <li key={r.id} className="rounded border bg-white p-3 text-sm"><b>{r.reviewerLabel ?? r.reviewerAddress.slice(0, 12)}</b>: {r.note}</li>)}</ul>
            )}

            <h2 className="text-lg font-semibold mt-6">Wallet policy preview</h2>
            <div className="rounded border bg-white p-3 text-sm space-y-2">
                <label className="flex gap-2 items-center">Minimum badge
                    <select value={minBadge} onChange={(e) => setMinBadge(e.target.value)} className="border rounded px-2">
                        <option value="unchecked">unchecked</option><option value="auto-checked">auto-checked</option><option value="reviewed">reviewed</option>
                    </select>
                </label>
                <label className="flex gap-2 items-center"><input type="checkbox" checked={blockFlagged} onChange={(e) => setBlockFlagged(e.target.checked)} />Block templates with open flags</label>
                {decision ? (
                    <p className={decision.decision === 'allow' ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'} data-testid="decision">
                        {decision.decision === 'allow' ? 'Your wallet would allow this template.' : 'Your wallet would block this template.'} {decision.reasons.join(' ')}
                    </p>
                ) : null}
            </div>

            <h2 className="text-lg font-semibold mt-6">Report a problem ({detail.openFlags} open)</h2>
            <div className="flex gap-2 mt-2">
                <input aria-label="Flag reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What is wrong with this template?" className="border rounded px-3 py-2 flex-1" />
                <button onClick={submitFlag} className="rounded bg-slate-900 text-white px-4">Flag</button>
            </div>
            {flagMessage ? <p className="text-sm mt-1">{flagMessage}</p> : null}
        </div>
    );
}
