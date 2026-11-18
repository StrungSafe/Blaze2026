
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import {
  X,
  Wallet,
  Loader2,
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Smartphone,
  ScanLine,
  Sparkles,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

import { shortenAddress, useWallet } from "../hub/WalletContext";

// The wallet connection itself lives in hub/WalletContext, shared by the whole site. This modal only shows the steps
// (QR code, link, status) and reads whether a wallet is connected.

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type MobileScreen = "choices" | "wizard";

function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const {
    connected,
    walletName,
    address,
    status,
    start,
    disconnect,
  } = useWallet();

  const [qr, setQr] = useState<string | null>(null);
  const [walletUri, setWalletUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mobileScreen, setMobileScreen] =
    useState<MobileScreen>("choices");

  const wasConnected = useRef(connected);

  // Clears only what this modal shows. The shared wallet connection is not touched here.
  function resetView() {
    setQr(null);
    setWalletUri(null);
    setError(null);
    setConnecting(false);
    setCopied(false);
    setMobileScreen("choices");
  }

  useEffect(() => {
    if (!isOpen) resetView();
  }, [isOpen]);

  // When a wallet finishes connecting, drop the QR and close the modal shortly after.
  useEffect(() => {
    const justConnected = connected && !wasConnected.current;

    wasConnected.current = connected;

    if (!connected) return;

    setConnecting(false);
    setQr(null);
    setWalletUri(null);

    if (!justConnected || !isOpen) return;

    const timer = window.setTimeout(onClose, 1400);

    return () => window.clearTimeout(timer);
  }, [connected, isOpen, onClose]);

  function closeModal() {
    onClose();
  }

  function disconnectWallet() {
    disconnect();
    resetView();
  }

  async function connectWallet() {
    if (connecting || connected) return;

    setConnecting(true);
    setError(null);
    setCopied(false);
    setQr(null);
    setWalletUri(null);

    try {
      const created = start();

      const standardUri =
        typeof created.uri === "string" && created.uri.length > 0
          ? created.uri
          : created.qrUri;

      const qrUri = created.qrUri;

      if (!standardUri || !qrUri) {
        throw new Error(
          "WizardConnect did not return a valid connection URI."
        );
      }

      setWalletUri(standardUri);

      const qrCode = await QRCode.toDataURL(qrUri, {
        width: 220,
        margin: 1,
        errorCorrectionLevel: "M",
        color: {
          dark: "#080A12",
          light: "#FFFFFF",
        },
      });

      setQr(qrCode);
    } catch (reason) {
      disconnect();
      setConnecting(false);

      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to start wallet connection. Please try again."
      );
    }
  }

  async function copyWalletLink() {
    if (!walletUri) return;

    try {
      await navigator.clipboard.writeText(walletUri);
      setCopied(true);
      setError(null);

      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setError("Unable to copy connection link. Please try again.");
    }
  }

  function selectWizardConnect() {
    setMobileScreen("wizard");
    setError(null);
    connectWallet();
  }

  function backToChoices() {
    // Cancel a connection attempt, but never drop a wallet that is already connected.
    if (!connected) disconnect();

    resetView();
  }

  if (!isOpen) return null;

  return (
    <div
      className="wallet-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-[#05070b]/85 px-3 py-3 backdrop-blur-md"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wallet-title"
        className="wallet-modal relative w-full max-w-[340px] rounded-[19px] p-[1px] sm:max-w-[390px] lg:max-w-[690px]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="wallet-modal-border absolute inset-0 rounded-[19px]">
          <div className="wallet-modal-border-glow" />
        </div>

        <div className="relative overflow-hidden rounded-[18px] border border-white/[0.06] bg-[#080A12] p-4 sm:p-5 lg:p-6">
          <div className="pointer-events-none absolute -left-20 -top-20 h-40 w-40 rounded-full bg-violet-600/15 blur-[75px]" />
          <div className="pointer-events-none absolute -right-20 bottom-0 h-40 w-40 rounded-full bg-orange-500/10 blur-[75px]" />

          <div className="relative z-10">

            {/* MOBILE: CONNECTION OPTIONS */}
            <div className="lg:hidden">
              {mobileScreen === "choices" ? (
                <>
                  <button
                    type="button"
                    onClick={closeModal}
                    aria-label="Close wallet modal"
                    className="absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-400 transition hover:border-orange-500/40 hover:text-white"
                  >
                    <X size={17} />
                  </button>

                  <div className="pr-10">
                    <h2
                      id="connect-wallet-title"
                      className="text-xl font-bold tracking-tight text-white"
                    >
                      Connect a wallet
                    </h2>

                    <p className="mt-2 text-xs leading-5 text-slate-400">
                      Choose how your Bitcoin Cash wallet connects.
                    </p>
                  </div>

                  <div className="mt-6 space-y-3">
                    <button
                      type="button"
                      onClick={selectWizardConnect}
                      className="wallet-choice-card flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 text-left transition hover:border-orange-500/40 hover:bg-white/[0.06]"
                    >
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-orange-500/15 bg-orange-500/10 text-orange-400">
                        <Sparkles size={25} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">
                          Wizard Connect
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-slate-400">
                          Connect an HD wallet that supports Wizard Connect.
                        </p>
                      </div>

                      <ChevronRight
                        size={18}
                        className="shrink-0 text-slate-500"
                      />
                    </button>
                  </div>

                  <div className="mt-5 flex items-center gap-2 border-t border-white/[0.07] pt-4">
                    <ShieldCheck
                      size={15}
                      className="shrink-0 text-emerald-400"
                    />
                    <p className="text-[10px] leading-4 text-slate-500">
                      XOGrid will never ask for your recovery phrase or
                      private keys.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={backToChoices}
                      className="flex items-center gap-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
                    >
                      <ChevronLeft size={16} />
                      Back
                    </button>

                    <button
                      type="button"
                      onClick={closeModal}
                      aria-label="Close wallet modal"
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.05] text-slate-400 transition hover:text-white"
                    >
                      <X size={17} />
                    </button>
                  </div>

                  <div className="mt-4 text-center">
                    <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                      <Sparkles size={22} />
                    </div>

                    <h2 className="mt-3 text-lg font-bold text-white">
                      Wizard Connect
                    </h2>

                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Scan the QR code or copy the connection link to open
                      your compatible wallet.
                    </p>
                  </div>

                  {connected ? (
                    <div className="mt-5 flex flex-col items-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] p-5 text-center">
                      <Check size={30} className="text-emerald-400" />
                      <p className="mt-2 text-sm font-semibold text-emerald-400">
                        Connected to {walletName}
                      </p>
                      {address && (
                        <p
                          title={address}
                          className="mt-1 font-mono text-[11px] text-slate-300"
                        >
                          {shortenAddress(address)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        This wallet is used across XOGrid until you disconnect.
                      </p>
                      <button
                        type="button"
                        onClick={disconnectWallet}
                        className="mt-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-300"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="mt-5 flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-white/[0.08] bg-black/20 p-4">
                        {qr ? (
                          <>
                            <div className="rounded-xl bg-white p-2">
                              <img
                                src={qr}
                                alt="WizardConnect wallet QR code"
                                className="h-[180px] w-[180px] rounded-md"
                              />
                            </div>

                            <p className="mt-3 text-[10px] text-orange-400">
                              {status || "Waiting for wallet connection..."}
                            </p>
                          </>
                        ) : connecting ? (
                          <>
                            <Loader2
                              size={28}
                              className="animate-spin text-orange-400"
                            />
                            <p className="mt-3 text-xs text-slate-300">
                              Preparing your connection...
                            </p>
                          </>
                        ) : (
                          <>
                            <ScanLine
                              size={28}
                              className="text-slate-500"
                            />
                            <p className="mt-3 text-xs text-slate-400">
                              QR code not available.
                            </p>
                            <button
                              type="button"
                              onClick={connectWallet}
                              className="mt-3 rounded-lg bg-orange-500 px-4 py-2 text-xs font-semibold text-white"
                            >
                              Try again
                            </button>
                          </>
                        )}
                      </div>

                      {walletUri && (
                        <>
                          <a
                            href={walletUri}
                            className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-3 text-xs font-bold text-white transition hover:from-orange-400 hover:to-orange-300"
                          >
                            <ExternalLink size={15} />
                            Open compatible wallet
                          </a>

                          <button
                            type="button"
                            onClick={copyWalletLink}
                            className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-semibold text-slate-300 transition hover:border-orange-500/30 hover:text-white"
                          >
                            {copied ? (
                              <Check
                                size={15}
                                className="text-emerald-400"
                              />
                            ) : (
                              <Copy size={15} />
                            )}
                            {copied
                              ? "Connection link copied"
                              : "Copy connection link"}
                          </button>
                        </>
                      )}

                      {connecting && (
                        <button
                          type="button"
                          onClick={connectWallet}
                          className="mt-3 flex w-full items-center justify-center gap-2 text-[11px] text-slate-500 hover:text-orange-400"
                        >
                          <RefreshCw size={12} />
                          Generate new connection
                        </button>
                      )}
                    </>
                  )}

                  {status && !qr && !connected && (
                    <p className="mt-3 text-center text-[10px] text-slate-500">
                      {status}
                    </p>
                  )}

                  <div className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-3">
                    <Smartphone
                      size={14}
                      className="mt-0.5 shrink-0 text-orange-400"
                    />
                    <p className="text-[10px] leading-4 text-slate-500">
                      Use a compatible Bitcoin Cash HD wallet such as
                      Selene or Paytaca.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* DESKTOP: EXISTING WIZARDCONNECT EXPERIENCE */}
            <div className="hidden lg:block">
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close wallet modal"
                className="absolute right-0 top-0 z-20 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-slate-400 transition hover:rotate-90 hover:border-orange-500/40 hover:text-orange-400"
              >
                <X size={15} />
              </button>

              <div className="flex flex-row items-center gap-6">
                <div className="min-w-0 flex-1">
                  <div className="wallet-icon-animation relative mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 lg:mx-0">
                    <div className="wallet-icon-ring absolute inset-0 rounded-xl border border-orange-400/30" />
                    <Wallet size={21} />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#080A12] bg-orange-500 text-white">
                      <Sparkles size={8} />
                    </span>
                  </div>

                  <div className="mt-3 text-center lg:text-left">
                    <div className="mb-1.5 inline-flex items-center gap-1.5 rounded-full border border-orange-500/15 bg-orange-500/[0.07] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-wider text-orange-400">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-orange-400" />
                      Secure connection
                    </div>

                    <h2 className="text-xl font-bold tracking-tight text-white">
                      Connect your wallet
                    </h2>

                    <p className="mx-auto mt-1 max-w-[270px] text-xs leading-5 text-slate-400 lg:mx-0">
                      Connect your Bitcoin Cash wallet to access XOGrid.
                    </p>
                  </div>

                  <div className="wallet-option-card mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/15 bg-orange-500/10 text-orange-400">
                        <Wallet size={19} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-white">
                            WizardConnect
                          </p>
                          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-1.5 py-0.5 text-[8px] font-semibold text-emerald-400">
                            Supported
                          </span>
                        </div>

                        <p className="mt-0.5 text-[10px] text-slate-400">
                          Compatible Bitcoin Cash HD wallets
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 border-t border-white/[0.07] pt-3">
                      <p className="text-[11px] leading-5 text-slate-400">
                        Connect an HD wallet that supports{" "}
                        <span className="font-semibold text-orange-400">
                          WizardConnect
                        </span>
                        , such as Selene or Paytaca.
                      </p>
                    </div>

                    {!walletUri && !connected && (
                      <button
                        type="button"
                        onClick={connectWallet}
                        disabled={connecting}
                        className="wallet-connect-button mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-orange-400 px-4 py-3 text-xs font-bold text-white shadow-lg shadow-orange-500/15 transition hover:-translate-y-0.5 hover:from-orange-400 hover:to-orange-300 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {connecting ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Wallet size={15} />
                        )}
                        {connecting
                          ? "Preparing connection..."
                          : "Connect an HD Wallet"}
                      </button>
                    )}

                    {connected && (
                      <div className="mt-3 flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.07] p-3">
                        <Check size={17} className="text-emerald-400" />
                        <p className="text-xs font-semibold text-emerald-400">
                          Connected to {walletName}
                        </p>
                      </div>
                    )}

                    {status && !connected && (
                      <div className="mt-2 flex items-start gap-2 rounded-lg border border-orange-500/10 bg-orange-500/[0.05] p-2">
                        <span className="mt-1 h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-orange-400" />
                        <p className="text-[10px] leading-4 text-orange-300">
                          {status}
                        </p>
                      </div>
                    )}
                  </div>

                </div>

                <div className="min-w-0 flex-1">
                  {connected ? (
                    <div className="flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-5 text-center">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                        <Check size={25} />
                      </div>
                      <p className="mt-3 text-sm font-bold text-white">
                        Wallet connected
                      </p>
                      {address && (
                        <p
                          title={address}
                          className="mt-1 font-mono text-[11px] text-slate-300"
                        >
                          {shortenAddress(address)}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-slate-400">
                        {walletName} is used across XOGrid until you disconnect.
                      </p>
                      <button
                        type="button"
                        onClick={disconnectWallet}
                        className="mt-4 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-[11px] font-semibold text-slate-300 transition hover:border-rose-400/40 hover:text-rose-300"
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : qr ? (
                    <div className="wallet-qr-panel flex flex-col items-center rounded-xl border border-white/[0.08] bg-black/30 p-4 text-center">
                      <div className="mb-3 flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/[0.07] px-2.5 py-1">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                        <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400">
                          Ready to connect
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <ScanLine size={16} className="text-orange-400" />
                        <p className="text-sm font-bold text-white">
                          Scan to connect
                        </p>
                      </div>

                      <p className="mt-1.5 max-w-[220px] text-[10px] leading-4 text-slate-400">
                        Scan with Selene, Paytaca or another compatible wallet.
                      </p>

                      <div className="mt-3 rounded-xl bg-white p-2 shadow-[0_0_30px_rgba(249,115,22,0.10)]">
                        <img
                          src={qr}
                          alt="WizardConnect wallet QR code"
                          width={190}
                          height={190}
                          className="h-[170px] w-[170px] rounded-md"
                        />
                      </div>

                      <p className="mt-2 text-[10px] text-orange-400">
                        {status || "Waiting for wallet connection..."}
                      </p>

                      {walletUri && (
                        <button
                          type="button"
                          onClick={copyWalletLink}
                          className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-semibold text-slate-300 transition hover:border-orange-500/30 hover:text-white"
                        >
                          {copied ? (
                            <Check size={13} className="text-emerald-400" />
                          ) : (
                            <Copy size={13} />
                          )}
                          {copied ? "Copied" : "Copy connection link"}
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="flex min-h-[290px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-center">
                      <div className="qr-placeholder-icon flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/[0.08] text-orange-400">
                        <ScanLine size={22} />
                      </div>
                      <p className="mt-3 text-sm font-semibold text-white">
                        Desktop wallet connection
                      </p>
                      <p className="mt-1 max-w-[220px] text-[10px] leading-5 text-slate-500">
                        Generate a QR code and scan it using your compatible
                        Bitcoin Cash wallet.
                      </p>
                      <div className="mt-3 flex items-center gap-1.5 text-[9px] uppercase tracking-wider text-slate-600">
                        <ShieldCheck size={12} />
                        Secure connection
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mt-3 rounded-lg border border-rose-500/20 bg-rose-500/[0.08] p-2.5 text-center text-[11px] leading-5 text-rose-300"
              >
                {error}
              </div>
            )}

            <div className="mt-4 hidden items-start gap-2.5 border-t border-white/[0.07] pt-3 lg:flex">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-400"
              />
              <div>
                <p className="text-[10px] font-semibold text-slate-300">
                  Your wallet. Your control.
                </p>
                <p className="mt-0.5 text-[9px] leading-4 text-slate-500">
                  XOGrid will never ask for your recovery phrase or private
                  keys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .wallet-modal-backdrop {
          animation: walletBackdropIn 220ms ease-out both;
        }

        .wallet-modal {
          isolation: isolate;
          background: linear-gradient(
            135deg,
            rgba(249, 115, 22, 0.65),
            rgba(124, 58, 237, 0.3),
            rgba(249, 115, 22, 0.65)
          );
          animation: walletZoomIn 350ms cubic-bezier(0.16, 1, 0.3, 1) both;
          box-shadow: 0 20px 65px rgba(0, 0, 0, 0.6);
        }

        .wallet-modal-border {
          overflow: hidden;
          pointer-events: none;
        }

        .wallet-modal-border-glow {
          position: absolute;
          inset: -100%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 275deg,
            #f97316 305deg,
            #fb923c 320deg,
            #a855f7 335deg,
            transparent 360deg
          );
          animation: walletBorderRotate 5s linear infinite;
        }

        .wallet-icon-animation {
          animation: walletFloat 4s ease-in-out infinite;
        }

        .wallet-icon-ring {
          animation: walletIconPulse 2.8s ease-in-out infinite;
        }

        .wallet-option-card,
        .wallet-choice-card {
          animation: walletContentIn 450ms 80ms both;
        }

        .wallet-qr-panel {
          animation: walletContentIn 400ms ease-out both;
        }

        .wallet-connect-button {
          position: relative;
          overflow: hidden;
        }

        @keyframes walletBorderRotate {
          to { transform: rotate(360deg); }
        }

        @keyframes walletZoomIn {
          from {
            opacity: 0;
            transform: scale(0.95) translateY(12px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes walletBackdropIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes walletFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }

        @keyframes walletIconPulse {
          0%, 100% {
            opacity: 0.25;
            transform: scale(1);
          }
          50% {
            opacity: 0.8;
            transform: scale(1.05);
          }
        }

        @keyframes walletContentIn {
          from {
            opacity: 0;
            transform: translateY(7px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wallet-modal,
          .wallet-modal-backdrop,
          .wallet-modal-border-glow,
          .wallet-icon-animation,
          .wallet-icon-ring,
          .wallet-option-card,
          .wallet-choice-card,
          .wallet-qr-panel {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  );
}

export default ConnectWalletModal;
