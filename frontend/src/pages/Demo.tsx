import { binToHex } from '@bitauth/libauth';
import QRCode from 'qrcode';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
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

const SATS_PER_BCH = 100_000_000;
const explorer = (network: Network, id: string): string | undefined => (network === 'mainnet' ? `https://blockchair.com/bitcoin-cash/transaction/${id}` : undefined);

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
    return (
        <section className="mt-6 rounded-2xl border border-white/[0.09] bg-[#0D1117] p-5">
            <h2 className="font-semibold"><span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">{n}</span>{title}</h2>
            <div className="mt-3 space-y-3">{children}</div>
        </section>
    );
}

const button = 'rounded-lg bg-orange-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-orange-400 disabled:opacity-40 disabled:hover:bg-orange-500';
const input = 'rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-white outline-none focus:border-orange-500/50';

export default function Demo() {
    const fragment = useMemo(() => parseClaimFragment(window.location.hash), []);
    const [network, setNetwork] = useState<Network>(fragment.network ?? 'chipnet');
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
    const [issued, setIssued] = useState<{ code: string; transactionId: string; network: Network } | undefined>();
    const [claimCode, setClaimCode] = useState(fragment.code ?? '');
    const [destination, setDestination] = useState('');
    const [claimed, setClaimed] = useState<{ transactionId: string; network: Network } | undefined>();
    const [claimStatus, setClaimStatus] = useState('');

    const enabled = network === 'chipnet' || mainnetOk;
    const amountSats = (() => {
        try {
            return BigInt(amount.trim() === '' ? '0' : amount.trim());
        } catch {
            return 0n;
        }
    })();

    useEffect(() => {
        hub<Summary>(`/api/templates/${VOUCHER_TEMPLATE_IDENTIFIER}`).then(setTemplate).catch(() => setTemplate(undefined));
    }, []);

    useEffect(() => () => {
        wallet.current.stop();
        void chain.current?.close();
    }, []);

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
            setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
            setBusy(false);
        }
    };

    const connect = () => {
        setError('');
        setWalletName(undefined);

        const session = wallet.current.start(setRelayStatus, (name) => setWalletName(name));

        if (qrCanvas.current) {
            void QRCode.toCanvas(qrCanvas.current, session.qrUri, { width: 240 });
        }
    };

    const findCoins = () => {
        if (scanning) {
            return;
        }

        setScanning(true);
        setCoins([]);
        setChosen(undefined);
        run(async () => {
            const found = await scanCoins(wallet.current, getChain());

            setCoins(found);

            if (found.length === 0) {
                setError(network === 'chipnet' ? 'No coins found. In Selene, switch to chipnet and fund it from a chipnet faucet (tbch.googol.cash), then press Find coins again.' : 'No plain coins found in the first 20 receive and change addresses.');
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

            buildIssue(chosen, amountSats, hash); // throws a readable error if the coin or amount cannot work

            const signedHex = await wallet.current.sign(buildIssueSignRequest(chosen, amountSats, hash), chosen.pathName, chosen.addressIndex);
            const verdict = verifySignedIssue(chosen, amountSats, hash, signedHex);

            if (!verdict.valid || !verdict.transactionHex || !verdict.transactionId) {
                throw new Error(`The signed transaction did not pass XOGrid's check, so it was NOT sent. ${verdict.reason ?? ''}`);
            }

            // Show the code before broadcasting, so it can never be lost if the broadcast step is slow.
            const codeHex = binToHex(code);

            setIssued({ code: codeHex, transactionId: verdict.transactionId, network });
            setClaimCode(codeHex);

            const returned = await getChain().broadcast(verdict.transactionHex);

            if (returned !== verdict.transactionId) {
                throw new Error(`The server returned a different transaction id (${returned}).`);
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

            const voucher = await getChain().findVoucher(voucherLockingBytecode(codeHash(code)));

            if (!voucher) {
                throw new Error('No unspent voucher matches that code on this network. It may already be claimed, still unconfirmed, or on the other network.');
            }

            setClaimStatus(`Found a voucher holding ${voucher.valueSatoshis} sats. Checking the claim...`);

            const verdict = prepareClaim(voucher, code, target);

            if (!verdict.valid || !verdict.transactionHex || !verdict.transactionId) {
                throw new Error(verdict.reason ?? 'The claim did not verify.');
            }

            const returned = await getChain().broadcast(verdict.transactionHex);

            setClaimed({ transactionId: returned, network });
            setClaimStatus('');
        });

    const claimLink = issued ? `${window.location.origin}/demo${claimFragment(parseClaimCode(issued.code), issued.network)}` : '';
    const suggestedAddress = chosen ? addressFor(walletLockingBytecode(chosen.publicKey), network) : coins[0] ? addressFor(walletLockingBytecode(coins[0].publicKey), network) : '';

    return (
        <main className="relative min-h-screen bg-[#05070b] px-4 pb-20 pt-8 text-white sm:px-6">
        <div className="mx-auto max-w-3xl">
            <Link to="/" className="inline-flex items-center gap-3">
                <img src={xogridlogo} alt="XOGrid" className="h-10 w-auto object-contain" />
            </Link>
            <h1 className="mt-8 text-3xl font-semibold tracking-tight">Demo: claim-code vouchers</h1>
            <p className="mt-2 text-gray-400">
                Lock a little BCH behind a secret code. Whoever has the code can claim it, with no address needed up front and no wallet signature to claim.
                The voucher is an XO template, fetched from the XOGrid registry by its content-addressed id.
            </p>
            <p className="mt-2 text-sm text-gray-500">
                Template: <b>{template?.name ?? 'Claim-Code Voucher'}</b> <code className="break-all text-gray-300">{VOUCHER_TEMPLATE_IDENTIFIER}</code>
                {template && <> · {template.badge}</>}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                <span className="font-medium text-white">Network</span>
                {(Object.keys(NETWORKS) as Network[]).map((name) => (
                    <label key={name} className="flex items-center gap-1">
                        <input type="radio" className="accent-orange-500" checked={network === name} onChange={() => resetForNetwork(name)} /> {NETWORKS[name].label}
                    </label>
                ))}
            </div>
            {network === 'mainnet' && (
                <label className="mt-2 flex items-start gap-2 rounded border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
                    <input type="checkbox" className="mt-1 accent-orange-500" checked={mainnetOk} onChange={(event) => setMainnetOk(event.target.checked)} />
                    <span><b>Real money.</b> I understand this sends real BCH on mainnet. I will keep amounts small and save the claim code, because XOGrid does not store it.</span>
                </label>
            )}

            {error && <p className="mt-4 rounded border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</p>}

            <Step n={1} title="Connect your wallet">
                <p className="text-sm text-gray-400">Open a WizardConnect wallet such as Selene or Paytaca{network === 'chipnet' ? ' (set to chipnet)' : ''}, choose WizardConnect and scan the code.</p>
                <button className={button} disabled={!enabled || busy} onClick={connect}>Show QR code</button>
                <canvas ref={qrCanvas} className="block rounded-xl bg-white p-2" />
                <p className="text-sm">{walletName ? <span className="text-emerald-400">Connected to {walletName}.</span> : relayStatus && <span className="text-gray-500">Relay: {relayStatus}</span>}</p>
            </Step>

            <Step n={2} title="Create a voucher">
                <button className={button} disabled={!enabled || !walletName || busy || scanning} onClick={findCoins}>{scanning ? 'Scanning...' : 'Find my coins'}</button>
                {coins.length > 0 && (
                    <div className="space-y-1">
                        {coins.map((coin) => (
                            <button
                                key={`${coin.transactionHash}:${coin.outputIndex}`}
                                onClick={() => setChosen(coin)}
                                className={`block w-full rounded border px-3 py-2 text-left text-sm ${chosen === coin ? 'border-orange-500/60 bg-orange-500/10' : 'border-white/10 hover:bg-white/[0.04]'}`}
                            >
                                {coin.valueSatoshis.toString()} sats <span className="text-gray-500">({coin.pathName}/{coin.addressIndex}, {coin.transactionHash.slice(0, 8)}…:{coin.outputIndex})</span>
                            </button>
                        ))}
                    </div>
                )}
                <label className="block text-sm text-gray-300">
                    Voucher amount (sats, at least {MINIMUM_VOUCHER_SATOSHIS.toString()})
                    <input className={`ml-2 w-32 ${input}`} value={amount} onChange={(event) => setAmount(event.target.value)} inputMode="numeric" />
                </label>
                {chosen && (
                    <p className="text-sm text-gray-400">
                        Locks {amountSats.toString()} sats in the voucher, pays a {ISSUE_FEE_SATOSHIS.toString()} sat network fee, and returns the rest to your own address
                        {amountSats >= MINIMUM_VOUCHER_SATOSHIS && chosen.valueSatoshis >= amountSats + ISSUE_FEE_SATOSHIS ? ` (${(chosen.valueSatoshis - amountSats - ISSUE_FEE_SATOSHIS).toString()} sats).` : '.'}
                    </p>
                )}
                <button className={button} disabled={!enabled || !chosen || busy || amountSats < MINIMUM_VOUCHER_SATOSHIS} onClick={issue}>{busy && chosen ? 'Waiting for your wallet…' : 'Create voucher (approve in your wallet)'}</button>
                {issued && (
                    <div className="rounded border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                        <p className="font-semibold">Voucher created. Save this claim code now: XOGrid does not store it.</p>
                        <p className="mt-2 break-all font-mono text-base">{issued.code}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                            <button className={button} onClick={() => void navigator.clipboard.writeText(issued.code)}>Copy code</button>
                            <button className={button} onClick={() => void navigator.clipboard.writeText(claimLink)}>Copy claim link</button>
                        </div>
                        <p className="mt-2 break-all text-gray-400">Transaction {issued.transactionId}{explorer(issued.network, issued.transactionId) && <> · <a className="text-orange-400 underline" href={explorer(issued.network, issued.transactionId)} target="_blank" rel="noreferrer">view</a></>}</p>
                        <p className="mt-1 text-gray-400">The claim link keeps the code after the # sign, which browsers never send to any server.</p>
                    </div>
                )}
            </Step>

            <Step n={3} title="Claim a voucher">
                <p className="text-sm text-gray-400">Anyone with the code can do this, from any browser. No wallet signature is needed. The page proves the claim valid in the BCH virtual machine before sending it. Network fee {CLAIM_FEE_SATOSHIS.toString()} sats.</p>
                <label className="block text-sm text-gray-300">Claim code
                    <input className={`mt-1 w-full ${input} font-mono`} value={claimCode} onChange={(event) => setClaimCode(event.target.value)} placeholder="32 hex characters" />
                </label>
                <label className="block text-sm text-gray-300">Send the funds to (a {NETWORKS[network].prefix}: address)
                    <input className={`mt-1 w-full ${input} font-mono`} value={destination} onChange={(event) => setDestination(event.target.value)} placeholder={`${NETWORKS[network].prefix}:q...`} />
                </label>
                {suggestedAddress && destination === '' && <button className="text-sm text-orange-400 underline" onClick={() => setDestination(suggestedAddress)}>Use my wallet address</button>}
                <button className={button} disabled={!enabled || busy || claimCode.trim() === '' || destination.trim() === ''} onClick={claim}>Claim voucher</button>
                {claimStatus && <p className="text-sm text-gray-500">{claimStatus}</p>}
                {claimed && (
                    <div className="rounded border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm text-emerald-100">
                        <p className="font-semibold">Claimed. The code is now public on chain, so this voucher is spent.</p>
                        <p className="mt-1 break-all text-gray-400">Transaction {claimed.transactionId}{explorer(claimed.network, claimed.transactionId) && <> · <a className="text-orange-400 underline" href={explorer(claimed.network, claimed.transactionId)} target="_blank" rel="noreferrer">view</a></>}</p>
                    </div>
                )}
            </Step>

            <p className="mt-6 text-xs text-gray-500">
                Know the limits: the code becomes public when it is claimed, and a code can be raced in the mempool by anyone who sees the claim, so keep amounts small.
                One wallet connection method is built in today (WizardConnect); others plug in through the same wallet interface.
            </p>
        </div>
        </main>
    );
}
