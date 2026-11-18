/** Shared building blocks, with the class recipes from frontend/src/pages/Demo.tsx. */
import { Check, Copy } from 'lucide-react';
import { useState, type ReactNode } from 'react';

const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40';

export const primaryButton = `${buttonBase} bg-orange-500 text-white shadow-lg shadow-orange-500/20 enabled:hover:-translate-y-0.5 enabled:hover:bg-orange-400 enabled:hover:shadow-orange-500/30`;

export const secondaryButton = `${buttonBase} border border-white/10 bg-white/[0.04] text-gray-200 enabled:hover:border-orange-500/40 enabled:hover:bg-orange-500/10 enabled:hover:text-white`;

export const smallButton =
    'inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-gray-200 transition enabled:hover:border-orange-500/40 enabled:hover:bg-orange-500/10 enabled:hover:text-white disabled:cursor-not-allowed disabled:opacity-40';

export const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#080B10] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10';

export const cardClass = 'rounded-2xl border border-white/[0.08] bg-[#0D1117]/90 shadow-2xl shadow-black/20 backdrop-blur-xl';

export function Section({ icon, title, description, children }: { icon: ReactNode; title: string; description?: ReactNode; children: ReactNode }) {
    return (
        <section className={`${cardClass} relative overflow-hidden p-5 sm:p-7`}>
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-orange-500/[0.04] blur-3xl" />
            <div className="relative">
                <div className="mb-6 flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{title}</h2>
                        {description && <div className="mt-1 text-sm leading-relaxed text-gray-500">{description}</div>}
                    </div>
                </div>
                <div className="space-y-4">{children}</div>
            </div>
        </section>
    );
}

export function StatusMessage({ children, type = 'info' }: { children: ReactNode; type?: 'success' | 'error' | 'info' | 'warning' }) {
    const styles = {
        success: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300',
        error: 'border-rose-500/20 bg-rose-500/[0.07] text-rose-300',
        info: 'border-orange-500/20 bg-orange-500/[0.07] text-orange-200',
        warning: 'border-amber-500/30 bg-amber-500/[0.08] text-amber-200',
    };

    return <div className={`rounded-xl border p-4 text-sm leading-relaxed ${styles[type]}`}>{children}</div>;
}

/**
 * Writes `text` to the clipboard. Some browsers (embedded panes, locked-down profiles) refuse the async Clipboard API;
 * then it falls back to copying from a hidden textarea, which still works during a click.
 */
async function writeClipboard(text: string): Promise<boolean> {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch {
        const area = document.createElement('textarea');

        area.value = text;
        area.setAttribute('readonly', '');
        area.style.position = 'fixed';
        area.style.opacity = '0';
        document.body.append(area);
        area.select();

        try {
            return document.execCommand('copy');
        } catch {
            return false;
        } finally {
            area.remove();
        }
    }
}

/** Copies `text` exactly as given. */
export function CopyButton({ text, label, className = smallButton, iconSize = 14 }: { text: string; label: string; className?: string; iconSize?: number }) {
    const [copied, setCopied] = useState(false);
    const [failed, setFailed] = useState(false);

    const copy = async (): Promise<void> => {
        const done = await writeClipboard(text);

        setFailed(!done);
        setCopied(done);

        if (done) {
            window.setTimeout(() => setCopied(false), 1800);
        }
    };

    return (
        <button type="button" className={className} onClick={() => void copy()}>
            {copied ? <Check size={iconSize} className="text-emerald-400" /> : <Copy size={iconSize} />}
            {copied ? 'Copied' : failed ? 'Copy blocked — select the text instead' : label}
        </button>
    );
}

export function Pill({ children, tone = 'gray' }: { children: ReactNode; tone?: 'gray' | 'orange' | 'emerald' | 'rose' | 'violet' }) {
    const tones = {
        gray: 'border-white/10 bg-white/[0.04] text-gray-400',
        orange: 'border-orange-500/25 bg-orange-500/10 text-orange-300',
        emerald: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
        rose: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
        violet: 'border-violet-500/25 bg-violet-500/10 text-violet-300',
    };

    return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${tones[tone]}`}>{children}</span>;
}

export const formatSatoshis = (satoshis: bigint): string => `${satoshis.toLocaleString('en-US')} sats`;

export const formatBch = (satoshis: bigint): string => {
    const whole = satoshis / 100_000_000n;
    const fraction = (satoshis % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');

    return `${whole.toLocaleString('en-US')}${fraction ? `.${fraction}` : ''} BCH`;
};

export const shortHash = (hash: string): string => `${hash.slice(0, 10)}…${hash.slice(-6)}`;
