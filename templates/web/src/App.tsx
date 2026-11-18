import { Wrench } from 'lucide-react';
import logo from '../../../frontend/src/assets/images/xogridlogo.png';
import { DripMinePanel } from './components/DripMinePanel';
import { Pill, cardClass } from './components/ui';

/** Templates in this workspace. Only those with a panel can make invitations so far. */
const TEMPLATES = [
    { name: 'Drip Mine', folder: 'drip-mine', ready: true },
    { name: 'Block Points', folder: 'block-points', ready: false },
    { name: 'Badgers Stake', folder: 'badgers-stake', ready: false },
    { name: 'Token Burner', folder: 'token-burner', ready: false },
    { name: 'Revenue Split', folder: 'revenue-split', ready: false },
];

export function App() {
    return (
        <main className="relative min-h-screen overflow-hidden bg-[#05070B] pb-24 text-white">
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-orange-600/[0.09] blur-[130px]" />
                <div className="absolute -right-40 top-[35%] h-[500px] w-[500px] rounded-full bg-violet-500/[0.06] blur-[140px]" />
                <div
                    className="absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                    }}
                />
            </div>

            <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
                <header className="flex items-center justify-between gap-4 border-b border-white/[0.07] py-5">
                    <div className="flex items-center gap-4">
                        <img src={logo} alt="XOGrid" className="h-9 w-auto object-contain sm:h-10" />
                        <div className="hidden h-6 w-px bg-white/10 sm:block" />
                        <h1 className="hidden text-lg font-semibold tracking-tight sm:block">Template tools</h1>
                    </div>
                    <Pill tone="orange">
                        <Wrench size={12} /> Dev only
                    </Pill>
                </header>

                <div className="py-8 sm:py-10">
                    <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                        Build{' '}
                        <span className="bg-gradient-to-r from-orange-300 via-orange-500 to-amber-300 bg-clip-text text-transparent">XO invitations</span> for
                        the templates
                    </h2>
                    <p className="mt-3 max-w-3xl text-sm leading-7 text-gray-400">
                        Pick a contract coin and copy a ready invitation for an XO wallet to import and spend. Everything runs in this browser: coins come
                        from public Electrum servers, and nothing is broadcast from here.
                    </p>
                </div>

                <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
                    <nav className={`${cardClass} h-fit p-3`} aria-label="Templates">
                        <div className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">Templates</div>
                        <ul className="space-y-1">
                            {TEMPLATES.map((template) => (
                                <li key={template.folder}>
                                    <div
                                        className={`flex items-center justify-between rounded-xl px-3 py-2.5 text-sm ${
                                            template.ready ? 'border border-orange-500/25 bg-orange-500/10 font-semibold text-white' : 'text-gray-500'
                                        }`}
                                        aria-current={template.ready ? 'page' : undefined}
                                    >
                                        {template.name}
                                        {!template.ready && <span className="text-[10px] uppercase tracking-wider text-gray-600">not yet</span>}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <DripMinePanel />
                </div>
            </div>
        </main>
    );
}
