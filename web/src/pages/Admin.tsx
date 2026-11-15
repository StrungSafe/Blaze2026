import QRCode from 'qrcode';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Summary } from '../api';
import { signLoginChallenge, startWalletSession, type WalletSession } from '../wallet';

interface AdminSummary {
    templates: { total: number; removed: number; byBadge: Record<string, number>; withFailingChecks: number };
    openFlags: number; reviews: number;
    recentActions: { actor: string; action: string; identifier: string | null; note: string; at: string }[];
}
interface FlagRow { id: number; identifier: string; templateName: string; reason: string; reporter: string; createdAt: string }

const TOKEN_KEY = 'xo-hub-admin-token';
const readToken = (): string => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ''; } catch { return ''; } };
const saveToken = (value: string): void => { try { value ? sessionStorage.setItem(TOKEN_KEY, value) : sessionStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ } };

export function Admin() {
    const [token, setToken] = useState(readToken());
    const [name, setName] = useState('');

    useEffect(() => {
        if (!token) return;
        api<{ admin: string }>('/api/admin/me', { token }).then((r) => setName(r.admin)).catch(() => { saveToken(''); setToken(''); });
    }, [token]);

    if (!token) return <Login onLogin={(t) => { saveToken(t); setToken(t); }} />;

    return <Portal token={token} name={name} onLogout={() => { void api('/api/admin/logout', { method: 'POST', body: {}, token }).catch(() => undefined); saveToken(''); setToken(''); }} />;
}

function Login({ onLogin }: { onLogin: (token: string) => void }) {
    const [status, setStatus] = useState('');
    const [error, setError] = useState('');
    const [ready, setReady] = useState('');
    const session = useRef<WalletSession | null>(null);
    const canvas = useRef<HTMLCanvasElement>(null);

    useEffect(() => () => session.current?.cleanup(), []);

    function connect() {
        session.current?.cleanup();
        setError('');
        session.current = startWalletSession(setStatus, setReady);
        if (canvas.current) void QRCode.toCanvas(canvas.current, session.current.qrUri, { width: 240 });
    }

    async function signIn() {
        try {
            setError('');
            const { nonce } = await api<{ nonce: string }>('/api/admin/challenge', { method: 'POST', body: {} });
            const signedTransaction = await signLoginChallenge(session.current!, nonce);
            const result = await api<{ token: string }>('/api/admin/login', { method: 'POST', body: { nonce, proof: { type: 'transaction', signedTransaction } } });

            onLogin(result.token);
        } catch (e) {
            setError((e as Error).message);
        }
    }

    return (
        <div className="mt-6 max-w-md">
            <h1 className="text-2xl font-bold">Moderator sign in</h1>
            <p className="text-slate-600 text-sm mt-1">Connect a WizardConnect wallet such as Selene. You sign a message-only transaction that is never broadcast and moves no funds.</p>
            <button onClick={connect} className="mt-3 rounded bg-slate-900 text-white px-4 py-2">Connect wallet</button>
            <canvas ref={canvas} className="mt-3" />
            {status ? <p className="text-xs text-slate-500">Relay: {status}</p> : null}
            {ready ? <button onClick={signIn} className="mt-2 rounded bg-emerald-700 text-white px-4 py-2">Sign in with {ready}</button> : null}
            {error ? <p className="text-red-700 mt-2 text-sm">{error}</p> : null}
        </div>
    );
}

function Portal({ token, name, onLogout }: { token: string; name: string; onLogout: () => void }) {
    const [summary, setSummary] = useState<AdminSummary | null>(null);
    const [flags, setFlags] = useState<FlagRow[]>([]);
    const [templates, setTemplates] = useState<Summary[]>([]);
    const [note, setNote] = useState('');
    const [message, setMessage] = useState('');

    const refresh = useCallback(() => {
        void api<AdminSummary>('/api/admin/summary', { token }).then(setSummary);
        void api<{ items: FlagRow[] }>('/api/admin/flags', { token }).then((r) => setFlags(r.items));
        void api<{ items: Summary[] }>('/api/templates?pageSize=50').then((r) => setTemplates(r.items));
    }, [token]);

    useEffect(refresh, [refresh]);

    const noteOk = note.trim().length >= 3;

    async function act(path: string, body: unknown, method = 'POST') {
        try {
            await api(path, { method, body, token });
            setMessage('Done.');
            refresh();
        } catch (e) {
            setMessage((e as Error).message);
        }
    }

    return (
        <div className="mt-4">
            <div className="flex items-center gap-3"><h1 className="text-2xl font-bold">Moderation</h1><span className="text-sm text-slate-500">signed in as {name}</span><button onClick={onLogout} className="ml-auto underline text-sm">Sign out</button></div>
            {message ? <p className="text-sm mt-2">{message}</p> : null}
            {summary ? <p className="text-sm text-slate-600 mt-2">{summary.templates.total} templates, {summary.openFlags} open flags, {summary.reviews} reviews, {summary.templates.withFailingChecks} with failing checks.</p> : null}

            <h2 className="text-lg font-semibold mt-6">Open flags</h2>
            {flags.length === 0 ? <p className="text-sm text-slate-500">None.</p> : flags.map((f) => (
                <div key={f.id} className="rounded border bg-white p-3 mt-2 text-sm">
                    <Link className="font-medium underline" to={`/t/${f.identifier}`}>{f.templateName}</Link>: {f.reason}
                    <div className="mt-2 flex gap-2">
                        <button className="border rounded px-2" onClick={() => act(`/api/admin/flags/${f.id}/resolve`, { status: 'dismissed' })}>Dismiss</button>
                        <button className="border rounded px-2" onClick={() => act(`/api/admin/flags/${f.id}/resolve`, { status: 'upheld' })}>Uphold</button>
                    </div>
                </div>
            ))}

            <h2 className="text-lg font-semibold mt-6">Templates</h2>
            <input aria-label="Note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type a note first: review note, removal reason, or spotlight blurb (3+ characters)" className="border rounded px-3 py-2 w-full mt-2" />
            {templates.map((t) => (
                <div key={t.identifier} className="rounded border bg-white p-3 mt-2 text-sm flex flex-wrap gap-2 items-center">
                    <Link className="font-medium underline" to={`/t/${t.identifier}`}>{t.name}</Link><span className="text-slate-500">{t.badge}</span>
                    <span className="ml-auto flex gap-2">
                        <button className="border rounded px-2 disabled:opacity-40" disabled={!noteOk} onClick={() => act(`/api/admin/templates/${t.identifier}/review`, { note })}>Review</button>
                        <button className="border rounded px-2 disabled:opacity-40" disabled={!noteOk} onClick={() => { if (window.confirm(`Remove "${t.name}"? It stays listed as a removed tombstone with your reason.`)) void act(`/api/admin/templates/${t.identifier}/remove`, { reason: note }); }}>Remove</button>
                        <button className="border rounded px-2 disabled:opacity-40" disabled={!noteOk} onClick={() => act('/api/admin/spotlight', { items: [{ identifier: t.identifier, blurb: note }] }, 'PUT')}>Feature only this</button>
                    </span>
                </div>
            ))}

            <h2 className="text-lg font-semibold mt-6">Recent actions</h2>
            <ul className="text-sm text-slate-600">{summary?.recentActions.map((a, i) => <li key={i}>{a.at.slice(0, 16)} {a.actor} {a.action} {a.note}</li>)}</ul>
        </div>
    );
}
