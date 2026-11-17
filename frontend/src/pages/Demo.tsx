
import { binToHex } from '@bitauth/libauth';
import QRCode from 'qrcode';
import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    ArrowLeft,
    ArrowRight,
    Check,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    Copy,
    ExternalLink,
    Fingerprint,
    Loader2,
    LockKeyhole,
    QrCode,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    Wallet,
    Zap,
} from 'lucide-react';

import xogridlogo from '../assets/images/xogridlogo.png';
import { hub, type Summary } from '../hub/api';
import { Chain } from '../voucher/chain';

import {
    CLAIM_FEE_SATOSHIS,
    ISSUE_FEE_SATOSHIS,
    MINIMUM_VOUCHER_SATOSHIS,
    NETWORKS,
    VOUCHER_TEMPLATE_IDENTIFIER,
    addressFor,
    buildIssue,
    buildIssueSignRequest,
    claimFragment,
    codeHash,
    lockingBytecodeFromAddress,
    newClaimCode,
    parseClaimCode,
    parseClaimFragment,
    prepareClaim,
    verifySignedIssue,
    voucherLockingBytecode,
    walletLockingBytecode,
    type Coin,
    type Network,
} from '../voucher/core';

import { WizardConnectWallet, scanCoins } from '../voucher/wallet';

const explorer = (network: Network, id: string): string | undefined =>
    network === 'mainnet'
        ? `https://blockchair.com/bitcoin-cash/transaction/${id}`
        : undefined;

const buttonBase =
    'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40';

const primaryButton =
    `${buttonBase} bg-orange-500 text-white shadow-lg shadow-orange-500/20 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-orange-500/30`;

const secondaryButton =
    `${buttonBase} border border-white/10 bg-white/[0.04] text-gray-200 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-white`;

const inputClass =
    'w-full rounded-xl border border-white/10 bg-[#080B10] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-gray-600 focus:border-orange-500/60 focus:ring-2 focus:ring-orange-500/10';

const cardClass =
    'rounded-2xl border border-white/[0.08] bg-[#0D1117]/90 shadow-2xl shadow-black/20 backdrop-blur-xl';

const fadeUp = {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0 },
};

function Step({
    n,
    title,
    description,
    icon,
    children,
}: {
    n: number;
    title: string;
    description: string;
    icon: ReactNode;
    children: ReactNode;
}) {
    return (
        <motion.section
            variants={fadeUp}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.12 }}
            transition={{ duration: 0.55, delay: 0.08 * n }}
            className={`${cardClass} relative overflow-hidden p-5 sm:p-7`}
        >
            <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-orange-500/[0.04] blur-3xl" />

            <div className="relative">
                <div className="mb-6 flex items-start gap-4">
                    <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                        {icon}
                        <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 border-[#0D1117] bg-orange-500 text-[10px] font-bold text-white">
                            {n}
                        </span>
                    </div>

                    <div>
                        <h2 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
                            {title}
                        </h2>
                        <p className="mt-1 text-sm leading-relaxed text-gray-500">
                            {description}
                        </p>
                    </div>
                </div>

                <div className="space-y-4">{children}</div>
            </div>
        </motion.section>
    );
}

function StatusMessage({
    children,
    type = 'success',
}: {
    children: ReactNode;
    type?: 'success' | 'error' | 'info';
}) {
    const styles = {
        success: 'border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-300',
        error: 'border-rose-500/20 bg-rose-500/[0.07] text-rose-300',
        info: 'border-orange-500/20 bg-orange-500/[0.07] text-orange-200',
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`rounded-xl border p-4 text-sm leading-relaxed ${styles[type]}`}
        >
            {children}
        </motion.div>
    );
}

export default function Demo() {
    const navigate = useNavigate();

    const fragment = useMemo(
        () => parseClaimFragment(window.location.hash),
        []
    );

    const [network, setNetwork] = useState<Network>(
        fragment.network ?? 'chipnet'
    );

    const [mainnetOk, setMainnetOk] = useState(false);
    const [template, setTemplate] = useState<Summary | undefined>();

    const wallet = useRef(new WizardConnectWallet());
    const chain = useRef<Chain | undefined>(undefined);
    const qrCanvas = useRef<HTMLCanvasElement>(null);

    const [relayStatus, setRelayStatus] = useState('');
    const [walletName, setWalletName] = useState<string | undefined>();
    const [coins, setCoins] = useState<Coin[]>([]);
    const [scanning, setScanning] = useState(false);
    const [chosen, setChosen] = useState<Coin | undefined>();

    const [amount, setAmount] = useState('1000');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const [issued, setIssued] = useState<
        { code: string; transactionId: string; network: Network } | undefined
    >();

    const [claimCode, setClaimCode] = useState(fragment.code ?? '');
    const [destination, setDestination] = useState('');

    const [claimed, setClaimed] = useState<
        { transactionId: string; network: Network } | undefined
    >();

    const [claimStatus, setClaimStatus] = useState('');
    const [copied, setCopied] = useState('');

    const enabled = network === 'chipnet' || mainnetOk;

    const amountSats = (() => {
        try {
            return BigInt(amount.trim() === '' ? '0' : amount.trim());
        } catch {
            return 0n;
        }
    })();

    useEffect(() => {
        hub<Summary>(`/api/templates/${VOUCHER_TEMPLATE_IDENTIFIER}`)
            .then(setTemplate)
            .catch(() => setTemplate(undefined));
    }, []);

    useEffect(
        () => () => {
            wallet.current.stop();
            void chain.current?.close();
        },
        []
    );

    const resetForNetwork = (next: Network) => {
        wallet.current.stop();
        void chain.current?.close();

        chain.current = undefined;

        setNetwork(next);
        setMainnetOk(false);
        setWalletName(undefined);
        setRelayStatus('');
        setCoins([]);
        setChosen(undefined);
        setIssued(undefined);
        setClaimed(undefined);
        setError('');
    };

    const getChain = (): Chain => {
        chain.current ??= new Chain(network);
        return chain.current;
    };

    const run = async (action: () => Promise<void>) => {
        setBusy(true);
        setError('');

        try {
            await action();
        } catch (caught) {
            setError(
                caught instanceof Error ? caught.message : String(caught)
            );
        } finally {
            setBusy(false);
        }
    };

    const connect = () => {
        setError('');
        setWalletName(undefined);

        const session = wallet.current.start(
            setRelayStatus,
            (name) => setWalletName(name)
        );

        if (qrCanvas.current) {
            void QRCode.toCanvas(qrCanvas.current, session.qrUri, {
                width: 240,
                margin: 2,
                color: {
                    dark: '#111827',
                    light: '#FFFFFF',
                },
            });
        }
    };

    const findCoins = () => {
        if (scanning) return;

        setScanning(true);
        setCoins([]);
        setChosen(undefined);

        run(async () => {
            const found = await scanCoins(wallet.current, getChain());

            setCoins(found);

            if (found.length === 0) {
                setError(
                    network === 'chipnet'
                        ? 'No coins found. In Selene, switch to chipnet and fund it from a chipnet faucet (tbch.googol.cash), then press Find coins again.'
                        : 'No plain coins found in the first 20 receive and change addresses.'
                );
            }
        }).finally(() => setScanning(false));
    };

    const issue = () =>
        run(async () => {
            if (!chosen) {
                throw new Error('Choose a coin first.');
            }

            const code = newClaimCode();
            const hash = codeHash(code);

            buildIssue(chosen, amountSats, hash);

            const signedHex = await wallet.current.sign(
                buildIssueSignRequest(chosen, amountSats, hash),
                chosen.pathName,
                chosen.addressIndex
            );

            const verdict = verifySignedIssue(
                chosen,
                amountSats,
                hash,
                signedHex
            );

            if (
                !verdict.valid ||
                !verdict.transactionHex ||
                !verdict.transactionId
            ) {
                throw new Error(
                    `The signed transaction did not pass XOGrid's check, so it was NOT sent. ${verdict.reason ?? ''}`
                );
            }

            const codeHex = binToHex(code);

            setIssued({
                code: codeHex,
                transactionId: verdict.transactionId,
                network,
            });

            setClaimCode(codeHex);

            const returned = await getChain().broadcast(
                verdict.transactionHex
            );

            if (returned !== verdict.transactionId) {
                throw new Error(
                    `The server returned a different transaction id (${returned}).`
                );
            }

            setChosen(undefined);
            setCoins([]);
        });

    const claim = () =>
        run(async () => {
            setClaimStatus('');
            setClaimed(undefined);

            const code = parseClaimCode(claimCode);
            const target = lockingBytecodeFromAddress(destination, network);

            setClaimStatus('Looking for the voucher on chain...');

            const voucher = await getChain().findVoucher(
                voucherLockingBytecode(codeHash(code))
            );

            if (!voucher) {
                throw new Error(
                    'No unspent voucher matches that code on this network. It may already be claimed, still unconfirmed, or on the other network.'
                );
            }

            setClaimStatus(
                `Found a voucher holding ${voucher.valueSatoshis} sats. Checking the claim...`
            );

            const verdict = prepareClaim(voucher, code, target);

            if (
                !verdict.valid ||
                !verdict.transactionHex ||
                !verdict.transactionId
            ) {
                throw new Error(verdict.reason ?? 'The claim did not verify.');
            }

            const returned = await getChain().broadcast(
                verdict.transactionHex
            );

            setClaimed({ transactionId: returned, network });
            setClaimStatus('');
        });

    const claimLink = issued
        ? `${window.location.origin}/demo${claimFragment(
              parseClaimCode(issued.code),
              issued.network
          )}`
        : '';

    const suggestedAddress = chosen
        ? addressFor(walletLockingBytecode(chosen.publicKey), network)
        : coins[0]
          ? addressFor(walletLockingBytecode(coins[0].publicKey), network)
          : '';

    const copyValue = async (value: string, label: string) => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(label);
            window.setTimeout(() => setCopied(''), 1800);
        } catch {
            setError('Unable to copy. Please select and copy the text manually.');
        }
    };

    const goBack = () => {
        if (window.history.length > 1) {
            navigate(-1);
        } else {
            navigate('/');
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#05070B] pb-24 text-white">
            {/* Animated background */}
            <div className="pointer-events-none fixed inset-0 overflow-hidden">
                <motion.div
                    animate={{
                        x: [0, 35, -20, 0],
                        y: [0, -25, 25, 0],
                        scale: [1, 1.15, 0.95, 1],
                    }}
                    transition={{
                        duration: 18,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                    className="absolute -left-40 -top-40 h-[500px] w-[500px] rounded-full bg-orange-600/[0.09] blur-[130px]"
                />

                <motion.div
                    animate={{
                        x: [0, -35, 20, 0],
                        y: [0, 30, -20, 0],
                        scale: [1, 0.9, 1.15, 1],
                    }}
                    transition={{
                        duration: 22,
                        repeat: Infinity,
                        ease: 'easeInOut',
                    }}
                    className="absolute -right-40 top-[35%] h-[500px] w-[500px] rounded-full bg-amber-500/[0.06] blur-[140px]"
                />

                <div
                    className="absolute inset-0 opacity-[0.12]"
                    style={{
                        backgroundImage:
                            'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.035) 1px, transparent 1px)',
                        backgroundSize: '60px 60px',
                        maskImage:
                            'linear-gradient(to bottom, black, transparent 85%)',
                    }}
                />
            </div>

            <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6">
                {/* Top navigation */}
                <motion.header
                    initial={{ opacity: 0, y: -15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="flex items-center justify-between border-b border-white/[0.07] py-5"
                >
                    <button
                        type="button"
                        onClick={goBack}
                        className="group inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm text-gray-300 transition hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-white"
                    >
                        <ArrowLeft
                            size={16}
                            className="transition-transform group-hover:-translate-x-1"
                        />
                        Back
                    </button>

                    <Link to="/" className="flex items-center">
                        <img
                            src={xogridlogo}
                            alt="XOGrid"
                            className="h-9 w-auto object-contain sm:h-10"
                        />
                    </Link>

                    <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2">
                        <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-300 sm:text-xs">
                            Demo live
                        </span>
                    </div>
                </motion.header>

                {/* Hero */}
                <motion.section
                    initial="hidden"
                    animate="visible"
                    variants={fadeUp}
                    transition={{ duration: 0.7 }}
                    className="relative py-12 text-center sm:py-16"
                >
                    <motion.div
                        animate={{ rotate: [0, 5, -5, 0] }}
                        transition={{
                            duration: 7,
                            repeat: Infinity,
                            ease: 'easeInOut',
                        }}
                        className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/25 bg-orange-500/10 shadow-xl shadow-orange-500/10"
                    >
                        <Fingerprint size={32} className="text-orange-400" />
                    </motion.div>

                    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.07] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-300">
                        <Sparkles size={14} />
                        XOGrid Voucher Experience
                    </div>

                    <h1 className="mx-auto max-w-3xl text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                        Send value with a{' '}
                        <span className="bg-gradient-to-r from-orange-300 via-orange-500 to-amber-300 bg-clip-text text-transparent">
                            secret code.
                        </span>
                    </h1>

                    <p className="mx-auto mt-5 max-w-2xl text-sm leading-7 text-gray-400 sm:text-base">
                        Create BCH vouchers secured by an on-chain secret.
                        Share the claim code with anyone. They can redeem it
                        without needing your wallet or an upfront address.
                    </p>

                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-gray-400">
                            <ShieldCheck size={14} className="text-emerald-400" />
                            On-chain verification
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-gray-400">
                            <LockKeyhole size={14} className="text-orange-400" />
                            Secret-code security
                        </div>
                        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-gray-400">
                            <Zap size={14} className="text-amber-400" />
                            Wallet powered
                        </div>
                    </div>
                </motion.section>

                {/* Template information */}
                <motion.div
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="mb-6 flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                            Powered by XOGrid registry
                        </p>
                        <p className="mt-1 truncate text-sm font-semibold text-gray-200">
                            {template?.name ?? 'Claim-Code Voucher'}
                        </p>
                        <code className="mt-1 block break-all text-[10px] text-gray-600">
                            {VOUCHER_TEMPLATE_IDENTIFIER}
                        </code>
                    </div>

                    {template?.badge && (
                        <span className="w-fit rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1.5 text-xs font-medium text-orange-300">
                            {template.badge}
                        </span>
                    )}
                </motion.div>

                {/* Network selector */}
                <motion.section
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className={`${cardClass} mb-6 p-5 sm:p-6`}
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <p className="text-sm font-semibold text-white">
                                Select your network
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                Choose where your voucher will be created.
                            </p>
                        </div>

                        <div className="flex rounded-xl border border-white/10 bg-black/30 p-1">
                            {(Object.keys(NETWORKS) as Network[]).map((name) => (
                                <button
                                    key={name}
                                    type="button"
                                    onClick={() => resetForNetwork(name)}
                                    className={`rounded-lg px-5 py-2.5 text-sm font-semibold transition-all ${
                                        network === name
                                            ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/20'
                                            : 'text-gray-500 hover:text-white'
                                    }`}
                                >
                                    {NETWORKS[name].label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <AnimatePresence>
                        {network === 'mainnet' && (
                            <motion.label
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-5 flex cursor-pointer items-start gap-3 overflow-hidden rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100"
                            >
                                <input
                                    type="checkbox"
                                    className="mt-1 h-4 w-4 accent-orange-500"
                                    checked={mainnetOk}
                                    onChange={(event) =>
                                        setMainnetOk(event.target.checked)
                                    }
                                />
                                <span className="leading-relaxed">
                                    <b className="block text-amber-300">
                                        Mainnet confirmation
                                    </b>
                                    Real money is involved. I understand this
                                    sends real BCH on mainnet. I will keep
                                    amounts small and save the claim code,
                                    because XOGrid does not store it.
                                </span>
                            </motion.label>
                        )}
                    </AnimatePresence>
                </motion.section>

                {/* Error message */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, y: -8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            className="mb-6"
                        >
                            <StatusMessage type="error">
                                <div className="flex items-start gap-2">
                                    <span className="font-bold">!</span>
                                    <span>{error}</span>
                                </div>
                            </StatusMessage>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Steps */}
                <div className="space-y-6">
                    {/* Step 1 */}
                    <Step
                        n={1}
                        title="Connect your wallet"
                        description="Connect a compatible wallet to securely access your BCH."
                        icon={<Wallet size={23} />}
                    >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                            <div className="min-w-0 flex-1">
                                <p className="text-sm leading-6 text-gray-400">
                                    Open a WizardConnect wallet such as Selene
                                    or Paytaca
                                    {network === 'chipnet'
                                        ? ' (set to chipnet)'
                                        : ''}
                                    , choose WizardConnect and scan the QR
                                    code.
                                </p>

                                <button
                                    type="button"
                                    className={`${primaryButton} mt-5`}
                                    disabled={!enabled || busy}
                                    onClick={connect}
                                >
                                    <QrCode size={17} />
                                    Show QR code
                                    <ArrowRight size={16} />
                                </button>

                                {walletName ? (
                                    <StatusMessage>
                                        <div className="flex items-center gap-2">
                                            <CheckCircle2 size={17} />
                                            Connected to {walletName}.
                                        </div>
                                    </StatusMessage>
                                ) : relayStatus ? (
                                    <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                                        <Loader2
                                            size={14}
                                            className="animate-spin text-orange-400"
                                        />
                                        Relay: {relayStatus}
                                    </p>
                                ) : null}
                            </div>

                            <div className="flex min-h-[220px] shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/30 p-4 sm:w-[270px]">
                                <AnimatePresence mode="wait">
                                    {walletName ? (
                                        <motion.div
                                            key="connected"
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="text-center"
                                        >
                                            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-emerald-500/20 bg-emerald-500/10">
                                                <Check
                                                    size={30}
                                                    className="text-emerald-400"
                                                />
                                            </div>
                                            <p className="mt-4 text-sm font-semibold text-emerald-300">
                                                Wallet connected
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                Your wallet is ready.
                                            </p>
                                        </motion.div>
                                    ) : (
                                        <motion.div
                                            key="qr"
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="flex flex-col items-center"
                                        >
                                            <canvas
                                                ref={qrCanvas}
                                                className="block max-w-full rounded-xl bg-white p-2"
                                            />
                                            {!relayStatus && (
                                                <div className="mt-3 flex items-center gap-2 text-xs text-gray-600">
                                                    <QrCode size={14} />
                                                    QR code appears here
                                                </div>
                                            )}
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </Step>

                    {/* Step 2 */}
                    <Step
                        n={2}
                        title="Create a voucher"
                        description="Choose an available coin and set the amount you want to lock."
                        icon={<CircleDollarSign size={23} />}
                    >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <p className="text-sm font-medium text-white">
                                    Available coins
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    Scan your wallet for spendable BCH.
                                </p>
                            </div>

                            <button
                                type="button"
                                className={secondaryButton}
                                disabled={!enabled || !walletName || busy || scanning}
                                onClick={findCoins}
                            >
                                {scanning ? (
                                    <Loader2 size={16} className="animate-spin" />
                                ) : (
                                    <RefreshCw size={16} />
                                )}
                                {scanning ? 'Scanning...' : 'Find my coins'}
                            </button>
                        </div>

                        <AnimatePresence>
                            {coins.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0 }}
                                    className="space-y-2"
                                >
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                                        Select a coin
                                    </p>

                                    {coins.map((coin) => (
                                        <button
                                            key={`${coin.transactionHash}:${coin.outputIndex}`}
                                            type="button"
                                            onClick={() => setChosen(coin)}
                                            className={`flex w-full items-center justify-between gap-3 rounded-xl border p-4 text-left transition-all ${
                                                chosen === coin
                                                    ? 'border-orange-500/50 bg-orange-500/[0.08]'
                                                    : 'border-white/[0.08] bg-black/20 hover:border-white/20'
                                            }`}
                                        >
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-white">
                                                    {coin.valueSatoshis.toString()}{' '}
                                                    <span className="text-gray-500">
                                                        sats
                                                    </span>
                                                </p>
                                                <p className="mt-1 truncate text-[11px] text-gray-500">
                                                    {coin.pathName}/
                                                    {coin.addressIndex} ·{' '}
                                                    {coin.transactionHash.slice(0, 8)}
                                                    …:{coin.outputIndex}
                                                </p>
                                            </div>

                                            <span
                                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                                                    chosen === coin
                                                        ? 'border-orange-500 bg-orange-500 text-white'
                                                        : 'border-white/20 text-transparent'
                                                }`}
                                            >
                                                <Check size={14} />
                                            </span>
                                        </button>
                                    ))}
                                </motion.div>
                            )}
                        </AnimatePresence>

                        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Voucher amount
                                <span className="ml-2 text-xs font-normal text-gray-500">
                                    Minimum {MINIMUM_VOUCHER_SATOSHIS.toString()} sats
                                </span>
                            </label>

                            <div className="relative mt-3">
                                <input
                                    className={`${inputClass} pr-20 font-mono text-base`}
                                    value={amount}
                                    onChange={(event) =>
                                        setAmount(event.target.value)
                                    }
                                    inputMode="numeric"
                                    placeholder="Enter amount in sats"
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-orange-400">
                                    SATS
                                </span>
                            </div>
                        </div>

                        {chosen && (
                            <StatusMessage type="info">
                                <p className="font-semibold text-orange-300">
                                    Voucher breakdown
                                </p>
                                <div className="mt-3 space-y-2 text-xs">
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-400">
                                            Voucher amount
                                        </span>
                                        <span className="text-white">
                                            {amountSats.toString()} sats
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3">
                                        <span className="text-gray-400">
                                            Network fee
                                        </span>
                                        <span className="text-white">
                                            {ISSUE_FEE_SATOSHIS.toString()} sats
                                        </span>
                                    </div>
                                    <div className="flex justify-between gap-3 border-t border-white/10 pt-2">
                                        <span className="text-gray-400">
                                            Change returned
                                        </span>
                                        <span className="font-semibold text-emerald-300">
                                            {amountSats >= MINIMUM_VOUCHER_SATOSHIS &&
                                            chosen.valueSatoshis >=
                                                amountSats + ISSUE_FEE_SATOSHIS
                                                ? `${(
                                                      chosen.valueSatoshis -
                                                      amountSats -
                                                      ISSUE_FEE_SATOSHIS
                                                  ).toString()} sats`
                                                : 'Not calculated'}
                                        </span>
                                    </div>
                                </div>
                            </StatusMessage>
                        )}

                        <button
                            type="button"
                            className={`${primaryButton} w-full sm:w-auto`}
                            disabled={
                                !enabled ||
                                !chosen ||
                                busy ||
                                amountSats < MINIMUM_VOUCHER_SATOSHIS
                            }
                            onClick={issue}
                        >
                            {busy ? (
                                <>
                                    <Loader2 size={17} className="animate-spin" />
                                    Waiting for your wallet...
                                </>
                            ) : (
                                <>
                                    <LockKeyhole size={17} />
                                    Create voucher
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>

                        <AnimatePresence>
                            {issued && (
                                <motion.div
                                    initial={{ opacity: 0, y: 15 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="overflow-hidden rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.05] p-5"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                                            <CheckCircle2 size={22} />
                                        </div>
                                        <div>
                                            <p className="font-semibold text-emerald-300">
                                                Voucher created
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                Save your claim code securely.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-5 rounded-xl border border-white/10 bg-black/30 p-4">
                                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-gray-500">
                                            Your secret claim code
                                        </p>
                                        <p className="break-all font-mono text-lg tracking-wider text-white">
                                            {issued.code}
                                        </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            className={secondaryButton}
                                            onClick={() =>
                                                void copyValue(issued.code, 'code')
                                            }
                                        >
                                            {copied === 'code' ? (
                                                <Check size={15} />
                                            ) : (
                                                <Copy size={15} />
                                            )}
                                            {copied === 'code'
                                                ? 'Copied'
                                                : 'Copy code'}
                                        </button>

                                        <button
                                            type="button"
                                            className={secondaryButton}
                                            onClick={() =>
                                                void copyValue(claimLink, 'link')
                                            }
                                        >
                                            {copied === 'link' ? (
                                                <Check size={15} />
                                            ) : (
                                                <Copy size={15} />
                                            )}
                                            {copied === 'link'
                                                ? 'Copied'
                                                : 'Copy claim link'}
                                        </button>
                                    </div>

                                    <p className="mt-4 break-all text-xs text-gray-500">
                                        Transaction: {issued.transactionId}
                                        {explorer(
                                            issued.network,
                                            issued.transactionId
                                        ) && (
                                            <>
                                                {' · '}
                                                <a
                                                    className="inline-flex items-center gap-1 text-orange-400 hover:text-orange-300"
                                                    href={explorer(
                                                        issued.network,
                                                        issued.transactionId
                                                    )}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    View transaction
                                                    <ExternalLink size={12} />
                                                </a>
                                            </>
                                        )}
                                    </p>

                                    <p className="mt-3 text-xs leading-relaxed text-gray-500">
                                        The claim link keeps the code after the
                                        # sign, which browsers never send to
                                        any server.
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Step>

                    {/* Step 3 */}
                    <Step
                        n={3}
                        title="Claim a voucher"
                        description="Redeem a voucher using its secret code and your BCH destination address."
                        icon={<Fingerprint size={23} />}
                    >
                        <p className="text-sm leading-6 text-gray-400">
                            Anyone with the code can redeem it from any browser.
                            No wallet signature is needed. The page verifies
                            the claim in the BCH virtual machine before
                            broadcasting the transaction.
                        </p>

                        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Secret claim code
                            </label>
                            <input
                                className={`${inputClass} mt-2 font-mono`}
                                value={claimCode}
                                onChange={(event) =>
                                    setClaimCode(event.target.value)
                                }
                                placeholder="32 hex characters"
                            />
                        </div>

                        <div className="rounded-xl border border-white/[0.07] bg-black/20 p-4">
                            <label className="block text-sm font-medium text-gray-300">
                                Destination address
                            </label>
                            <input
                                className={`${inputClass} mt-2 font-mono`}
                                value={destination}
                                onChange={(event) =>
                                    setDestination(event.target.value)
                                }
                                placeholder={`${NETWORKS[network].prefix}:q...`}
                            />

                            {suggestedAddress && destination === '' && (
                                <button
                                    type="button"
                                    className="mt-3 inline-flex items-center gap-2 text-xs font-medium text-orange-400 transition hover:text-orange-300"
                                    onClick={() =>
                                        setDestination(suggestedAddress)
                                    }
                                >
                                    <Wallet size={14} />
                                    Use my wallet address
                                    <ChevronRight size={13} />
                                </button>
                            )}
                        </div>

                        <div className="flex flex-col gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="text-xs text-gray-500">
                                    Claim network fee
                                </p>
                                <p className="mt-1 font-semibold text-white">
                                    {CLAIM_FEE_SATOSHIS.toString()} sats
                                </p>
                            </div>

                            <button
                                type="button"
                                className={`${primaryButton} w-full sm:w-auto`}
                                disabled={
                                    !enabled ||
                                    busy ||
                                    claimCode.trim() === '' ||
                                    destination.trim() === ''
                                }
                                onClick={claim}
                            >
                                {busy ? (
                                    <>
                                        <Loader2
                                            size={17}
                                            className="animate-spin"
                                        />
                                        Processing...
                                    </>
                                ) : (
                                    <>
                                        <LockKeyhole size={17} />
                                        Claim voucher
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        </div>

                        <AnimatePresence>
                            {claimStatus && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <StatusMessage type="info">
                                        <div className="flex items-center gap-2">
                                            <Loader2
                                                size={16}
                                                className="animate-spin"
                                            />
                                            {claimStatus}
                                        </div>
                                    </StatusMessage>
                                </motion.div>
                            )}

                            {claimed && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.97 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <StatusMessage>
                                        <div className="flex items-center gap-2 font-semibold">
                                            <CheckCircle2 size={18} />
                                            Voucher successfully claimed.
                                        </div>
                                        <p className="mt-2 text-xs text-gray-400">
                                            The code is now public on chain, so
                                            this voucher is spent.
                                        </p>
                                        <p className="mt-3 break-all text-xs text-gray-400">
                                            Transaction: {claimed.transactionId}
                                            {explorer(
                                                claimed.network,
                                                claimed.transactionId
                                            ) && (
                                                <>
                                                    {' · '}
                                                    <a
                                                        className="text-orange-400 hover:text-orange-300"
                                                        href={explorer(
                                                            claimed.network,
                                                            claimed.transactionId
                                                        )}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        View transaction
                                                    </a>
                                                </>
                                            )}
                                        </p>
                                    </StatusMessage>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </Step>
                </div>

                {/* Footer information */}
                <motion.footer
                    initial={{ opacity: 0 }}
                    whileInView={{ opacity: 1 }}
                    viewport={{ once: true }}
                    className="mt-10 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 sm:p-6"
                >
                    <div className="flex items-start gap-3">
                        <ShieldCheck
                            size={20}
                            className="mt-0.5 shrink-0 text-orange-400"
                        />
                        <div>
                            <p className="text-sm font-semibold text-gray-200">
                                A few things to keep in mind
                            </p>
                            <p className="mt-2 text-xs leading-6 text-gray-500">
                                The code becomes public when it is claimed, and
                                a code can be raced in the mempool by anyone
                                who sees the claim, so keep amounts small.
                                One wallet connection method is built in today
                                (WizardConnect); others plug in through the
                                same wallet interface.
                            </p>
                        </div>
                    </div>

                    <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-white/[0.07] pt-5 sm:flex-row">
                        <p className="text-xs text-gray-600">
                            XOGrid · Claim-Code Voucher Demo
                        </p>

                        <Link
                            to="/"
                            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-400 transition hover:text-orange-400"
                        >
                            Back to XOGrid
                            <ArrowRight size={14} />
                        </Link>
                    </div>
                </motion.footer>
            </div>
        </main>
    );
}
