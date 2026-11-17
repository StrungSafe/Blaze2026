
import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { X, Wallet, Loader2, ShieldCheck } from "lucide-react";

import {
  startWalletSession,
  type WalletSession,
} from "../hub/wallet";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

function ConnectWalletModal({
  isOpen,
  onClose,
}: ConnectWalletModalProps) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const session = useRef<WalletSession | null>(null);

  useEffect(() => {
    if (!isOpen) {
      session.current?.cleanup();
      session.current = null;
      setQr(null);
      setStatus("");
      setError(null);
      setConnecting(false);
    }
  }, [isOpen]);

  useEffect(() => {
    return () => {
      session.current?.cleanup();
      session.current = null;
    };
  }, []);

  function closeModal() {
    session.current?.cleanup();
    session.current = null;
    setQr(null);
    setStatus("");
    setError(null);
    setConnecting(false);
    onClose();
  }

  async function connectWallet() {
    if (connecting) return;

    setConnecting(true);
    setError(null);
    setStatus("Preparing wallet connection...");

    try {
      const created = startWalletSession(
        (message) => setStatus(message),
        (name) => {
          setStatus(`Connected to ${name}`);
          setConnecting(false);
          setQr(null);
        }
      );

      session.current = created;

      const qrCode = await QRCode.toDataURL(created.qrUri, {
        width: 240,
        margin: 1,
      });

      setQr(qrCode);
      setStatus("Waiting for your wallet to connect...");
    } catch (reason) {
      setConnecting(false);
      setError(
        reason instanceof Error
          ? reason.message
          : "Unable to start wallet connection."
      );
      setStatus("");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="wallet-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#05070b]/85 px-3 py-3 backdrop-blur-xl sm:px-4 sm:py-6"
      onClick={closeModal}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wallet-title"
        className="wallet-modal relative my-auto w-full max-w-md rounded-[24px] p-[2px] lg:max-w-3xl xl:max-w-4xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="wallet-modal-border absolute inset-0 rounded-[24px]">
          <div className="wallet-modal-border-glow" />
        </div>

        <div className="relative isolate overflow-hidden rounded-[22px] border border-white/[0.06] bg-[#05070b] p-4 shadow-2xl shadow-black/60 sm:p-6 lg:p-8">

          {/* Ambient lighting */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-52 w-52 rounded-full bg-violet-600/20 blur-[90px]" />

          <div className="pointer-events-none absolute -right-20 top-1/3 h-48 w-48 rounded-full bg-purple-500/15 blur-[90px]" />

          <div className="pointer-events-none absolute -bottom-24 -right-20 h-44 w-44 rounded-full bg-orange-500/10 blur-[90px]" />

          <div className="relative z-10">

            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close wallet modal"
              className="absolute right-0 top-0 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition duration-300 hover:rotate-90 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400 sm:h-9 sm:w-9"
            >
              <X size={17} />
            </button>

            {/* Main content: column on mobile, row on desktop */}
            <div className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:gap-8 xl:gap-10">

              {/* Left section */}
              <div className="min-w-0 flex-1">

                {/* Wallet icon */}
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-500/10 sm:h-14 sm:w-14 lg:mx-0 lg:h-16 lg:w-16 lg:rounded-2xl">
                  <Wallet
                    size={25}
                    className="sm:h-7 sm:w-7 lg:h-[30px] lg:w-[30px]"
                  />
                </div>

                {/* Heading */}
                <div className="mt-3 text-center sm:mt-4 lg:text-left">
                  <h2
                    id="connect-wallet-title"
                    className="text-xl font-bold tracking-tight text-white sm:text-2xl"
                  >
                    Connect your wallet
                  </h2>

                  <p className="mx-auto mt-1 max-w-xs text-xs leading-5 text-slate-400 sm:mt-2 sm:text-sm lg:mx-0">
                    Connect your Bitcoin Cash wallet to get started
                    with XOGrid.
                  </p>
                </div>

                {/* Wallet option */}
                <div className="mt-4 rounded-xl border border-white/[0.08] bg-white/[0.035] p-3 transition duration-300 hover:border-orange-500/30 hover:bg-white/[0.05] sm:mt-5 sm:rounded-2xl sm:p-4">

                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-orange-500/10 bg-orange-500/10 text-orange-400 sm:h-11 sm:w-11 sm:rounded-xl">
                      <Wallet size={19} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-white">
                        WizardConnect
                      </p>

                      <p className="mt-0.5 text-[11px] leading-4 text-slate-500 sm:text-xs">
                        Selene, Paytaca and compatible wallets
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={connectWallet}
                    disabled={connecting}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition duration-300 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60 sm:mt-4 sm:rounded-xl sm:py-3"
                  >
                    {connecting ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Wallet size={16} />
                    )}

                    {connecting
                      ? "Waiting for wallet..."
                      : "Connect wallet"}
                  </button>
                </div>
              </div>

              {/* Right section: desktop only */}
              <div className="hidden min-w-0 flex-1 lg:block">

                {qr ? (
                  <div className="flex flex-col items-center rounded-xl border border-white/10 bg-black/40 p-4 text-center sm:rounded-2xl sm:p-5">

                    <p className="text-sm font-semibold text-white">
                      Scan to connect
                    </p>

                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-400">
                      Open Selene, Paytaca or another compatible
                      wallet and scan this QR code.
                    </p>

                    <img
                      src={qr}
                      alt="Wallet connection QR code"
                      width={240}
                      height={240}
                      className="mt-4 w-full max-w-[220px] rounded-xl bg-white p-2"
                    />

                    <p className="mt-3 text-xs text-orange-400">
                      {status}
                    </p>
                  </div>
                ) : (
                  <div className="flex min-h-[230px] flex-col items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center sm:rounded-2xl">

                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
                      <Wallet size={21} />
                    </div>

                    <p className="mt-3 text-sm font-medium text-white">
                      Your wallet connection
                    </p>

                    <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                      Click Connect wallet to generate your secure
                      connection QR code.
                    </p>

                    {status && (
                      <p className="mt-2 text-xs text-orange-400">
                        {status}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Error */}
            {error && (
              <p className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-xs text-rose-300 sm:mt-4 sm:text-sm">
                {error}
              </p>
            )}

            {/* Security note */}
            <div className="mt-4 flex items-start gap-2 border-t border-white/[0.07] pt-3 sm:mt-5 sm:pt-4">
              <ShieldCheck
                size={15}
                className="mt-0.5 shrink-0 text-emerald-400"
              />

              <p className="text-[10px] leading-4 text-slate-500 sm:text-xs sm:leading-5">
                XOGrid will never ask for your wallet recovery
                phrase or private keys. Only connect through a
                wallet you trust.
              </p>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        .wallet-modal-backdrop {
          animation: walletBackdropIn 250ms ease-out both;
        }

        .wallet-modal {
          isolation: isolate;
          background: linear-gradient(
            135deg,
            rgba(249, 115, 22, 0.5),
            rgba(124, 58, 237, 0.25),
            rgba(249, 115, 22, 0.5)
          );
          animation: walletZoomIn 450ms cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        .wallet-modal-border {
          position: absolute;
          inset: 0;
          overflow: hidden;
          border-radius: 24px;
          pointer-events: none;
        }

        .wallet-modal-border-glow {
          position: absolute;
          inset: -100%;
          background: conic-gradient(
            from 0deg,
            transparent 0deg,
            transparent 285deg,
            #f97316 310deg,
            #fb923c 325deg,
            #f97316 340deg,
            transparent 360deg
          );
          animation: walletBorderRotate 3s linear infinite;
        }

        @keyframes walletBorderRotate {
          to {
            transform: rotate(360deg);
          }
        }

        @keyframes walletZoomIn {
          from {
            opacity: 0;
            transform: scale(0.88) translateY(18px);
          }
          to {
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }

        @keyframes walletBackdropIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .wallet-modal,
          .wallet-modal-backdrop,
          .wallet-modal-border-glow {
            animation: none;
          }
        }
      `}</style>
    </div>
  );
}

export default ConnectWalletModal;
