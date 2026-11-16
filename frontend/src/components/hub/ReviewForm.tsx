import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";

import { finishReview, startReview } from "../../hub/api";
import { publicKeyHex, signWithWallet, startWalletSession, type WalletSession } from "../../hub/wallet";
import { Stars } from "./Stars";

type Phase = "idle" | "connecting" | "signing" | "posting";

/**
 * Wallet-signed review. The server holds the review text while the wallet signs, so the signature can only publish
 * exactly what the user wrote. The wallet signs a message-only transaction that is never broadcast and moves no funds.
 */
export function ReviewForm({ identifier, onPosted }: { identifier: string; onPosted: () => void }) {
  const [rating, setRating] = useState(0);
  const [body, setBody] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const session = useRef<WalletSession | null>(null);

  useEffect(() => () => session.current?.cleanup(), []);

  const valid = rating >= 1 && body.trim().length >= 3 && body.trim().length <= 1000;

  async function postWith(current: WalletSession) {
    setPhase("signing");

    const publicKey = await publicKeyHex(current);
    const challenge = await startReview(identifier, rating, body.trim(), publicKey);

    if (!challenge.walletSignRequest) {
      throw new Error("The server did not return a signing request.");
    }

    const signed = await signWithWallet(current, challenge.walletSignRequest);

    setPhase("posting");
    await finishReview(identifier, challenge.nonce, signed);
    setDone(true);
    setPhase("idle");
    onPosted();
  }

  async function submit() {
    setError(null);

    try {
      if (session.current) {
        await postWith(session.current);

        return;
      }

      setPhase("connecting");

      const created = startWalletSession(setStatus, (name) => {
        setStatus(`Connected to ${name}`);
        setQr(null);
        postWith(created).catch(fail);
      });

      session.current = created;
      setQr(await QRCode.toDataURL(created.qrUri, { width: 240, margin: 1 }));
    } catch (reason) {
      fail(reason);
    }
  }

  function fail(reason: unknown) {
    setError(reason instanceof Error ? reason.message : "Something went wrong.");
    setPhase("idle");
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 p-5 text-sm text-emerald-200">
        <ShieldCheck size={18} className="mb-2" />
        Your review was signed by your wallet and published. Thank you.
      </div>
    );
  }

  const busy = phase !== "idle";

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-[#0c0e16]/80 p-5 sm:p-6">
      <h3 className="text-lg font-semibold text-white">Add your review</h3>
      <p className="mt-1 text-sm leading-6 text-slate-400">
        Your wallet signs the review to prove it comes from a real key. Nothing is broadcast and no funds move. One
        review per wallet per template.
      </p>

      <div className="mt-5">
        <Stars value={rating} onPick={setRating} size={26} />
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        maxLength={1000}
        rows={4}
        placeholder="What did you use this template for? How did it go?"
        className="mt-4 w-full rounded-2xl border border-white/[0.08] bg-[#080a10] p-4 text-sm text-white outline-none placeholder:text-slate-600 focus:border-violet-400/50"
      />
      <p className="mt-1 text-right text-xs text-slate-600">{body.trim().length} / 1000</p>

      {qr && (
        <div className="mt-4 flex flex-col items-center gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-5 text-center">
          <p className="text-sm text-slate-300">
            Open a WizardConnect wallet such as Selene or Paytaca, choose WizardConnect and scan this code.
          </p>
          <img src={qr} alt="WizardConnect QR code" className="rounded-xl bg-white p-2" width={240} height={240} />
          <p className="text-xs text-slate-500">{status}</p>
        </div>
      )}

      {error && <p className="mt-4 text-sm text-rose-300">{error}</p>}

      <button
        type="button"
        disabled={!valid || busy}
        onClick={submit}
        className="mt-5 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? <Loader2 size={16} className="animate-spin" /> : <Wallet size={16} />}
        {phase === "connecting"
          ? "Waiting for your wallet..."
          : phase === "signing"
            ? "Approve in your wallet..."
            : phase === "posting"
              ? "Publishing..."
              : "Sign with wallet and publish"}
      </button>
    </div>
  );
}
