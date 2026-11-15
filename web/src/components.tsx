import { Link } from 'react-router-dom';
import type { Badge, Summary } from './api';

const env = import.meta.env as Record<string, string | undefined>;

export function Banner() {
    const slides = env.VITE_SLIDES_URL;
    const repo = env.VITE_REPO_URL || 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid';
    const address = env.VITE_EMBER_ADDRESS;

    return (
        <div className="bg-slate-900 text-slate-100 text-sm px-4 py-2 flex flex-wrap gap-x-6 gap-y-1 items-center" data-testid="banner">
            <span className="font-semibold">BCH BLAZE 2026</span>
            {slides ? <a className="underline" href={slides}>Widget Factory slides</a> : <span className="opacity-60">Slides: link needed</span>}
            {repo ? <a className="underline" href={repo}>Repository</a> : null}
            <span className="break-all">EMBER2026 CashTokens address: <code>{address || 'address needed'}</code></span>
        </div>
    );
}

const badgeStyle: Record<Badge, string> = {
    unchecked: 'bg-slate-200 text-slate-800',
    'auto-checked': 'bg-sky-100 text-sky-900',
    reviewed: 'bg-emerald-100 text-emerald-900',
};
const badgeTitle: Record<Badge, string> = {
    unchecked: 'No checks recorded',
    'auto-checked': 'Automated checks found no failure. This is not a safety claim.',
    reviewed: 'A moderator reviewed this exact template.',
};

export function BadgePill({ badge }: { badge: Badge }) {
    return <span title={badgeTitle[badge]} className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeStyle[badge]}`}>{badge}</span>;
}

export function TemplateCard({ item, blurb }: { item: Summary; blurb?: string }) {
    return (
        <Link to={`/t/${item.identifier}`} className="block rounded-lg border border-slate-200 p-4 hover:border-slate-400 bg-white">
            <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold">{item.name}</h3>
                <BadgePill badge={item.badge} />
                {item.openFlags > 0 ? <span className="rounded-full bg-amber-100 text-amber-900 px-2 py-0.5 text-xs">{item.openFlags} open flag{item.openFlags === 1 ? '' : 's'}</span> : null}
            </div>
            <p className="text-sm text-slate-600 mt-1">{blurb ?? item.description}</p>
            <p className="text-xs text-slate-400 mt-2 font-mono break-all">{item.identifier.slice(0, 16)}…</p>
        </Link>
    );
}
