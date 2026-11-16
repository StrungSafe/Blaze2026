
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
        (message) => {
          setStatus(message);
        },
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
      className="wallet-modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-[#05070b]/85 px-4 py-6 backdrop-blur-xl"
      onClick={closeModal}
    >
      {/* Animated rectangular frame */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-wallet-title"
        className="wallet-modal relative w-full max-w-md rounded-[26px] p-[2px]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Orange moving border */}
        <div className="wallet-modal-border absolute inset-0 rounded-[26px]">
          <div className="wallet-modal-border-glow" />
        </div>

        {/* Main modal */}
        <div className="relative isolate overflow-hidden rounded-[24px] border border-white/[0.06] bg-[#05070b] p-6 shadow-2xl shadow-black/60 sm:p-8">

          {/* Purple ambient lighting */}
          <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-violet-600/20 blur-[100px]" />

          <div className="pointer-events-none absolute -right-20 top-1/3 h-56 w-56 rounded-full bg-purple-500/15 blur-[100px]" />

          {/* Orange ambient lighting */}
          <div className="pointer-events-none absolute -bottom-24 -right-20 h-52 w-52 rounded-full bg-orange-500/10 blur-[100px]" />

          <div className="relative z-10">

            {/* Close button */}
            <button
              type="button"
              onClick={closeModal}
              aria-label="Close wallet modal"
              className="absolute right-0 top-0 flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition duration-300 hover:rotate-90 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-400"
            >
              <X size={18} />
            </button>

            {/* Wallet icon */}
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400 shadow-lg shadow-orange-500/10">
              <Wallet size={30} />
            </div>

            {/* Heading */}
            <div className="mt-5 text-center">
              <h2
                id="connect-wallet-title"
                className="text-2xl font-bold tracking-tight text-white"
              >
                Connect your wallet
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Connect your Bitcoin Cash wallet to get started
                with XOGrid.
              </p>
            </div>

            {/* Wallet options */}
            <div className="mt-7 space-y-3">
              <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-4 transition duration-300 hover:border-orange-500/30 hover:bg-white/[0.05]">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/10 bg-orange-500/10 text-orange-400">
                    <Wallet size={21} />
                  </div>

                  <div className="flex-1">
                    <p className="font-semibold text-white">
                      WizardConnect
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      Selene, Paytaca and compatible wallets
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={connectWallet}
                  disabled={connecting}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-orange-500/20 transition duration-300 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-orange-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {connecting ? (
                    <Loader2 size={17} className="animate-spin" />
                  ) : (
                    <Wallet size={17} />
                  )}

                  {connecting
                    ? "Waiting for wallet..."
                    : "Connect wallet"}
                </button>
              </div>
            </div>

            {/* QR code */}
            {qr && (
              <div className="mt-5 flex flex-col items-center rounded-2xl border border-white/10 bg-black/40 p-5 text-center">
                <p className="text-sm font-medium text-white">
                  Scan to connect
                </p>

                <p className="mt-1 text-xs leading-5 text-slate-400">
                  Open Selene, Paytaca or another compatible
                  wallet and scan this QR code.
                </p>

                <img
                  src={qr}
                  alt="Wallet connection QR code"
                  width={240}
                  height={240}
                  className="mt-4 rounded-xl bg-white p-2"
                />

                <p className="mt-3 text-xs text-orange-400">
                  {status}
                </p>
              </div>
            )}

            {/* Status */}
            {!qr && status && (
              <p className="mt-4 text-center text-xs text-slate-400">
                {status}
              </p>
            )}

            {/* Error */}
            {error && (
              <p className="mt-4 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-center text-sm text-rose-300">
                {error}
              </p>
            )}

            {/* Security note */}
            <div className="mt-6 flex items-start gap-2 border-t border-white/[0.07] pt-5">
              <ShieldCheck
                size={16}
                className="mt-0.5 shrink-0 text-emerald-400"
              />

              <p className="text-xs leading-5 text-slate-500">
                XOGrid will never ask for your wallet recovery
                phrase or private keys. Only connect through a
                wallet you trust.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Animation styles */}
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
          border-radius: 26px;
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
