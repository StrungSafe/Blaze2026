import { useEffect, useRef, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Wallet } from "lucide-react";

import { useWallet } from "../hub/WalletContext";

// Guards a page behind a connected wallet. This is a front-end gate (the registry's public read API stays public);
// it stops the page from rendering without a wallet and sends the person back to the landing page when the wallet
// disconnects while they are on it.

export default function RequireWallet({ title, children }: { title: string; children: ReactNode }) {
  const { connected, restoring, openModal, status } = useWallet();
  const navigate = useNavigate();
  const wasConnected = useRef(false);

  useEffect(() => {
    if (connected) {
      wasConnected.current = true;
    } else if (wasConnected.current && !restoring) {
      wasConnected.current = false;
      navigate("/", { replace: true });
    }
  }, [connected, restoring, navigate]);

  if (connected) return <>{children}</>;

  return (
    <main className="flex min-h-[60vh] items-center justify-center px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0D1117] p-8 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500/10 text-orange-400">
          {restoring ? <Loader2 size={22} className="animate-spin" /> : <Wallet size={22} />}
        </div>
        <h1 className="text-xl font-semibold text-white">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          {restoring
            ? "Reconnecting to your wallet..."
            : "Connect a wallet to continue. It only proves who you are: no funds move and nothing is broadcast."}
        </p>
        {!restoring ? (
          <button
            type="button"
            onClick={() => openModal()}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-orange-400"
          >
            <Wallet size={16} />
            Connect wallet
          </button>
        ) : status ? (
          <p className="mt-3 text-xs text-slate-500">Relay: {status}</p>
        ) : null}
        <div className="mt-5">
          <Link to="/" className="text-xs text-slate-500 hover:text-orange-300">
            Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
