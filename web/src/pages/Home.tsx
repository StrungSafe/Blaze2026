import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Summary } from '../api';
import { TemplateCard } from '../components';

export function Home() {
    const [items, setItems] = useState<(Summary & { blurb: string })[]>([]);
    const [error, setError] = useState('');

    useEffect(() => {
        api<{ items: (Summary & { blurb: string })[] }>('/api/spotlight').then((r) => setItems(r.items)).catch((e: Error) => setError(e.message));
    }, []);

    return (
        <div>
            <h1 className="text-3xl font-bold mt-6">A registry for XO templates</h1>
            <p className="text-slate-600 mt-2 max-w-2xl">
                Find a template by its content identifier, see what automated checks found, read moderator reviews, and preview what
                your wallet policy would do with it before you ever sign.
            </p>
            <div className="mt-4 flex gap-3">
                <Link to="/browse" className="rounded bg-slate-900 text-white px-4 py-2">Browse templates</Link>
                <Link to="/demo" className="rounded border border-slate-400 px-4 py-2">Try the demo</Link>
            </div>
            <h2 className="text-xl font-semibold mt-8 mb-3">Featured</h2>
            {error ? <p className="text-red-700">{error}</p> : null}
            <div className="grid gap-3 sm:grid-cols-2">{items.map((item) => <TemplateCard key={item.identifier} item={item} blurb={item.blurb} />)}</div>
        </div>
    );
}
