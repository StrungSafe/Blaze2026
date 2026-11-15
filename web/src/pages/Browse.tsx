import { useEffect, useState } from 'react';
import { api, type Summary } from '../api';
import { TemplateCard } from '../components';

export function Browse() {
    const [query, setQuery] = useState('');
    const [badge, setBadge] = useState('');
    const [sort, setSort] = useState('newest');
    const [data, setData] = useState<{ items: Summary[]; total: number }>({ items: [], total: 0 });
    const [error, setError] = useState('');

    useEffect(() => {
        const params = new URLSearchParams({ sort, pageSize: '50' });

        if (query) params.set('query', query);
        if (badge) params.set('badge', badge);

        const timer = setTimeout(() => {
            api<{ items: Summary[]; total: number }>(`/api/templates?${params}`).then((r) => { setData(r); setError(''); }).catch((e: Error) => setError(e.message));
        }, 200);

        return () => clearTimeout(timer);
    }, [query, badge, sort]);

    return (
        <div>
            <h1 className="text-2xl font-bold mt-4">Browse</h1>
            <div className="flex flex-wrap gap-2 mt-3">
                <input aria-label="Search" placeholder="Search name or description" value={query} onChange={(e) => setQuery(e.target.value)} className="border rounded px-3 py-2 flex-1 min-w-48" />
                <select aria-label="Badge" value={badge} onChange={(e) => setBadge(e.target.value)} className="border rounded px-2">
                    <option value="">Any badge</option><option value="unchecked">unchecked</option><option value="auto-checked">auto-checked</option><option value="reviewed">reviewed</option>
                </select>
                <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value)} className="border rounded px-2">
                    <option value="newest">Newest</option><option value="name">Name</option><option value="flagged">Most flagged</option>
                </select>
            </div>
            {error ? <p className="text-red-700 mt-3">{error}</p> : null}
            <p className="text-sm text-slate-500 mt-3">{data.total} template{data.total === 1 ? '' : 's'}</p>
            <div className="grid gap-3 sm:grid-cols-2 mt-2">{data.items.map((item) => <TemplateCard key={item.identifier} item={item} />)}</div>
        </div>
    );
}
