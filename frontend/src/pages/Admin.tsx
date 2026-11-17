import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import QRCode from "qrcode";
import {
  Activity,
  ArrowLeft,
  Blocks,
  FileCheck2,
  Flag,
  Loader2,
  LogOut,
  MessageSquare,
  ShieldCheck,
  Wallet,
} from "lucide-react";

import xogridlogo from "../assets/images/xogridlogo.png";
import type { Summary } from "../hub/api";
import {
  SessionExpiredError,
  adminFlags,
  adminLogout,
  adminMe,
  adminSummary,
  adminTemplates,
  adminUserReviews,
  featureOnly,
  hideUserReview,
  readAdminToken,
  removeTemplate,
  requestChallenge,
  resolveFlag,
  restoreTemplate,
  reviewTemplate,
  saveAdminToken,
  submitLogin,
  unhideUserReview,
  type AdminFlag,
  type AdminSummary,
  type AdminUserReview,
} from "../hub/admin";
import { publicKeyHex, signWithWallet, startWalletSession, type WalletSession } from "../hub/wallet";

type Tab = "overview" | "flags" | "templates" | "reviews";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "flags", label: "Community reports", icon: Flag },
  { id: "templates", label: "Template registry", icon: Blocks },
  { id: "reviews", label: "Community reviews", icon: MessageSquare },
];

const field =
  "w-full rounded-lg border border-white/[0.09] bg-black/30 px-3 py-2 text-xs text-white outline-none transition placeholder:text-white/25 focus:border-amber-500/40";
const smallButton =
  "rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-white/80 transition hover:border-amber-500/40 hover:text-amber-300 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-white/10 disabled:hover:text-white/80";

const STYLE = `
  @keyframes adminFadeUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes adminGlow { 0%, 100% { opacity: .35; transform: scale(1); } 50% { opacity: .7; transform: scale(1.12); } }
  .admin-fade { animation: adminFadeUp .6s ease both; }
  .admin-ambient { animation: adminGlow 8s ease-in-out infinite; }
  .admin-grid-bg {
    background-image: linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
    background-size: 55px 55px;
    mask-image: linear-gradient(to bottom, black, transparent 85%);
  }
  @media (prefers-reduced-motion: reduce) {
    .admin-fade, .admin-ambient { animation: none !important; }
  }
`;

function Shell({ status, children }: { status?: string; children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <style>{STYLE}</style>
      <div className="admin-grid-bg pointer-events-none absolute inset-0" />
      <div className="admin-ambient pointer-events-none absolute -left-40 top-32 h-[420px] w-[420px] rounded-full bg-amber-500/[0.055] blur-[120px]" />

      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#0B0E13]/90 shadow-lg shadow-black/20 backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <img src={xogridlogo} alt="XOGrid" className="h-9 w-auto object-contain transition duration-300 group-hover:scale-105" />
            <span className="hidden border-l border-white/10 pl-3 text-xs font-medium tracking-wider text-gray-400 transition group-hover:text-amber-400 sm:block">
              ADMINISTRATION
            </span>
          </Link>

          {status ? (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.65)]" />
              <span className="text-xs font-medium text-amber-400">{status}</span>
            </div>
          ) : null}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-[116px] sm:px-8 lg:pt-[132px]">
        {children}

        <footer className="mt-14 flex items-center justify-between border-t border-white/[0.07] pt-7">
          <p className="text-[11px] text-gray-600">XOGrid Administration · access is checked by the server on every request</p>
          <Link to="/" className="group inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-amber-400">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
            Return to XOGrid
          </Link>
        </footer>
      </div>
    </main>
  );
}

export default function Admin() {
  const [token, setToken] = useState(readAdminToken());
  const [name, setName] = useState("");
  const [checking, setChecking] = useState(token !== "");

  const signOut = useCallback(() => {
    saveAdminToken("");
    setToken("");
    setName("");
  }, []);

  // A stored token is only a claim. Ask the server whether it is still a live moderator session.
  useEffect(() => {
    if (!token) {
      setChecking(false);
      return;
    }

    let current = true;

    adminMe(token)
      .then((me) => {
        if (current) setName(me.admin);
      })
      .catch(() => {
        if (current) signOut();
      })
      .finally(() => {
        if (current) setChecking(false);
      });

    return () => {
      current = false;
    };
  }, [token, signOut]);

  if (checking) {
    return (
      <Shell>
        <p className="flex items-center gap-2 text-sm text-gray-400">
          <Loader2 size={16} className="animate-spin" /> Checking your session...
        </p>
      </Shell>
    );
  }

  if (!token) {
    return (
      <Shell status="Sign in required">
        <Login
          onLogin={(newToken, admin) => {
            saveAdminToken(newToken);
            setName(admin);
            setToken(newToken);
          }}
        />
      </Shell>
    );
  }

  return (
    <Shell status={name ? `Signed in as ${name}` : "Signed in"}>
      <Portal
        token={token}
        onExpired={signOut}
        onLogout={() => {
          void adminLogout(token);
          signOut();
        }}
      />
    </Shell>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Login: connect a WizardConnect wallet, sign a message-only transaction (never broadcast), send it to the server.
// ---------------------------------------------------------------------------------------------------------------

function Login({ onLogin }: { onLogin: (token: string, admin: string) => void }) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [walletName, setWalletName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [triedKey, setTriedKey] = useState("");
  const session = useRef<WalletSession | null>(null);

  useEffect(() => () => session.current?.cleanup(), []);

  async function connect() {
    session.current?.cleanup();
    setError("");
    setTriedKey("");
    setWalletName("");

    try {
      session.current = startWalletSession(setStatus, setWalletName);
      setQr(await QRCode.toDataURL(session.current.qrUri, { width: 240, margin: 1 }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not start the wallet connection.");
    }
  }

  async function signIn() {
    if (!session.current || busy) return;

    setBusy(true);
    setError("");

    try {
      const key = await publicKeyHex(session.current);

      setTriedKey(key);

      const challenge = await requestChallenge(key);

      if (!challenge.walletSignRequest) {
        throw new Error("The server did not return a signing request.");
      }

      const signedTransaction = await signWithWallet(session.current, challenge.walletSignRequest);
      const result = await submitLogin(challenge.nonce, signedTransaction);

      session.current.cleanup();
      session.current = null;
      onLogin(result.token, result.admin);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-fade max-w-xl">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500">
        <ShieldCheck size={14} /> Private control center
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        Moderator sign in<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-gray-400">
        Connect a WizardConnect wallet such as Selene. You sign a message-only transaction that is never broadcast and moves no funds.
        The server checks that the signing key is on its moderator list.
      </p>

      <div className="mt-8 rounded-2xl border border-white/[0.09] bg-[#0D1117] p-6">
        <button
          type="button"
          onClick={connect}
          disabled={busy}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 disabled:opacity-50"
        >
          <Wallet size={17} />
          {qr ? "Restart wallet connection" : "Connect wallet"}
        </button>

        {qr && !walletName ? (
          <div className="mt-5">
            <img src={qr} alt="Wallet connection QR code" width={220} height={220} className="rounded-xl bg-white p-2" />
            <p className="mt-2 text-xs text-gray-500">Scan with Selene, Paytaca or another WizardConnect wallet.</p>
          </div>
        ) : null}

        {status ? <p className="mt-3 text-xs text-gray-500">Relay: {status}</p> : null}

        {walletName ? (
          <button
            type="button"
            onClick={signIn}
            disabled={busy}
            className="mt-5 flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50"
          >
            {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {busy ? "Approve in your wallet..." : `Sign in with ${walletName}`}
          </button>
        ) : null}

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300">
            <p>{error}</p>
            {triedKey && error === "Login failed." ? (
              <p className="mt-2 break-all text-rose-200/80">
                If you expected to be allowed in, ask the admin to add this key to the moderator list: <span className="font-mono">{triedKey}</span>
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------------------
// Portal
// ---------------------------------------------------------------------------------------------------------------

function Portal({ token, onLogout, onExpired }: { token: string; onLogout: () => void; onExpired: () => void }) {
  const [tab, setTab] = useState<Tab>("overview");
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [version, setVersion] = useState(0);

  const refresh = useCallback(() => setVersion((value) => value + 1), []);

  /** Runs a moderator action, shows the outcome, reloads the data, and returns true on success. */
  const act = useCallback(
    async (action: () => Promise<unknown>, success = "Done."): Promise<boolean> => {
      try {
        await action();
        setNotice({ ok: true, text: success });
        refresh();

        return true;
      } catch (reason) {
        if (reason instanceof SessionExpiredError) {
          onExpired();

          return false;
        }

        setNotice({ ok: false, text: reason instanceof Error ? reason.message : "That did not work." });

        return false;
      }
    },
    [onExpired, refresh],
  );

  const handleError = useCallback(
    (reason: unknown): string => {
      if (reason instanceof SessionExpiredError) {
        onExpired();
      }

      return reason instanceof Error ? reason.message : "Something went wrong.";
    },
    [onExpired],
  );

  return (
    <div className="admin-fade">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500">
            <ShieldCheck size={14} /> Private control center
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Administration<span className="text-amber-500">.</span>
          </h1>
        </div>
        <button type="button" onClick={onLogout} className={`${smallButton} inline-flex items-center gap-2 self-start`}>
          <LogOut size={14} /> Sign out
        </button>
      </div>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Administration sections">
        {TABS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition ${
                tab === item.id
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-white/[0.08] bg-white/[0.025] text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} /> {item.label}
            </button>
          );
        })}
      </nav>

      {notice ? (
        <p
          role="status"
          className={`mt-5 rounded-xl border px-4 py-3 text-xs ${
            notice.ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-rose-500/20 bg-rose-500/10 text-rose-300"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="mt-6">
        {tab === "overview" && <OverviewTab token={token} version={version} onError={handleError} />}
        {tab === "flags" && <FlagsTab token={token} version={version} act={act} onError={handleError} />}
        {tab === "templates" && <TemplatesTab token={token} version={version} act={act} onError={handleError} />}
        {tab === "reviews" && <ReviewsTab token={token} version={version} act={act} onError={handleError} />}
      </div>
    </div>
  );
}

interface TabProps {
  token: string;
  version: number;
  onError: (reason: unknown) => string;
}

interface ActProps extends TabProps {
  act: (action: () => Promise<unknown>, success?: string) => Promise<boolean>;
}

/** Loads data for a tab and reloads when any dependency changes (the version bumps after every action). */
function useTabData<T>(load: () => Promise<T>, deps: unknown[], onError: (reason: unknown) => string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let current = true;

    load()
      .then((value) => {
        if (current) {
          setData(value);
          setError("");
        }
      })
      .catch((reason: unknown) => {
        if (current) setError(onError(reason));
      });

    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error };
}

const card = "rounded-2xl border border-white/[0.09] bg-[#0D1117] p-5";
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

function ErrorLine({ message }: { message: string }) {
  return message ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300">{message}</p> : null;
}

function OverviewTab({ token, version, onError }: TabProps) {
  const { data, error } = useTabData<AdminSummary>(() => adminSummary(token), [version], onError);

  if (error) return <ErrorLine message={error} />;
  if (!data) return <p className="text-sm text-gray-500">Loading...</p>;

  const stats = [
    { label: "Templates", value: data.templates.total - data.templates.removed, icon: Blocks },
    { label: "Open reports", value: data.openFlags, icon: Flag },
    { label: "Moderator reviews", value: data.reviews, icon: FileCheck2 },
    { label: "With failing checks", value: data.templates.withFailingChecks, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className={card}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/[0.06]">
                <Icon size={18} className="text-amber-500" />
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums">{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Badges: {Object.entries(data.templates.byBadge).map(([badge, count]) => `${badge} ${count}`).join(" · ")}
        {data.templates.removed > 0 ? ` · removed ${data.templates.removed}` : ""}
      </p>

      <section>
        <h2 className="mb-3 text-base font-semibold">Recent moderator actions</h2>
        {data.recentActions.length === 0 ? (
          <p className="text-sm text-gray-500">No actions yet.</p>
        ) : (
          <ul className={`${card} divide-y divide-white/[0.06] p-0`}>
            {data.recentActions.map((action, index) => (
              <li key={index} className="flex flex-wrap gap-x-3 gap-y-1 px-5 py-3 text-xs">
                <span className="text-gray-500">{when(action.at)}</span>
                <span className="font-medium text-amber-400">{action.actor}</span>
                <span className="text-gray-300">{action.action}</span>
                <span className="min-w-0 break-words text-gray-500">{action.note}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function FlagsTab({ token, version, act, onError }: ActProps) {
  const { data, error } = useTabData<{ items: AdminFlag[] }>(() => adminFlags(token), [version], onError);

  if (error) return <ErrorLine message={error} />;
  if (!data) return <p className="text-sm text-gray-500">Loading...</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500">No open reports.</p>;

  return (
    <div className="space-y-3">
      {data.items.map((flag: AdminFlag) => (
        <div key={flag.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link to={`/t/${flag.identifier}`} className="text-sm font-semibold underline decoration-white/20 hover:text-amber-400">
                {flag.templateName}
              </Link>
              <p className="mt-2 break-words text-sm text-gray-300">{flag.reason}</p>
              <p className="mt-2 text-[11px] text-gray-500">
                Reported {when(flag.createdAt)} by {flag.reporter}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" className={smallButton} onClick={() => void act(() => resolveFlag(token, flag.id, "dismissed"), "Report dismissed.")}>
                Dismiss
              </button>
              <button type="button" className={smallButton} onClick={() => void act(() => resolveFlag(token, flag.id, "upheld"), "Report upheld.")}>
                Uphold
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function TemplatesTab({ token, version, act, onError }: ActProps) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const { data, error } = useTabData(() => adminTemplates(token, applied), [version, applied], onError);

  return (
    <div>
      <form
        className="mb-4 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(query);
        }}
      >
        <input aria-label="Search templates" className={field} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, description or identifier" />
        <button type="submit" className={smallButton}>
          Search
        </button>
      </form>

      <ErrorLine message={error} />
      {!data && !error ? <p className="text-sm text-gray-500">Loading...</p> : null}
      {data && data.items.length === 0 ? <p className="text-sm text-gray-500">No templates match.</p> : null}

      <div className="space-y-3">
        {data?.items.map((template) => (
          <TemplateRow key={template.identifier} token={token} template={template} act={act} />
        ))}
      </div>
    </div>
  );
}

function TemplateRow({ token, template, act }: { token: string; template: Summary; act: ActProps["act"] }) {
  const [note, setNote] = useState("");
  const ready = note.trim().length >= 3;

  return (
    <div className={card}>
      <div className="flex flex-wrap items-center gap-3">
        <Link to={`/t/${template.identifier}`} className="text-sm font-semibold underline decoration-white/20 hover:text-amber-400">
          {template.name}
        </Link>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-wider text-gray-400">
          {template.removed ? "removed" : template.badge}
        </span>
        {template.openFlags > 0 ? <span className="text-[11px] text-amber-400">{template.openFlags} open report{template.openFlags === 1 ? "" : "s"}</span> : null}
        <span className="ml-auto break-all font-mono text-[10px] text-gray-600">{template.identifier.slice(0, 16)}…</span>
      </div>

      {template.removed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
          <span className="min-w-0 break-words">Removed: {template.removedReason}</span>
          <button type="button" className={smallButton} onClick={() => void act(() => restoreTemplate(token, template.identifier), "Template restored.")}>
            Restore
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input
            aria-label={`Note for ${template.name}`}
            className={field}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Type a note first: review note, removal reason or featured blurb (3+ characters)"
          />
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              className={smallButton}
              disabled={!ready}
              onClick={() =>
                void act(() => reviewTemplate(token, template.identifier, note.trim()), "Review recorded.").then((ok) => ok && setNote(""))
              }
            >
              Review
            </button>
            <button
              type="button"
              className={smallButton}
              disabled={!ready}
              onClick={() => {
                if (!window.confirm(`Remove "${template.name}"? It stays listed as a removed tombstone with your reason.`)) return;

                void act(() => removeTemplate(token, template.identifier, note.trim()), "Template removed.").then((ok) => ok && setNote(""));
              }}
            >
              Remove
            </button>
            <button
              type="button"
              className={smallButton}
              disabled={!ready}
              onClick={() => {
                if (!window.confirm("This replaces the whole featured list on the Home page with this one template. Continue?")) return;

                void act(() => featureOnly(token, template.identifier, note.trim()), "Featured on Home.").then((ok) => ok && setNote(""));
              }}
            >
              Feature only
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewsTab({ token, version, act, onError }: ActProps) {
  const { data, error } = useTabData<{ items: AdminUserReview[] }>(() => adminUserReviews(token), [version], onError);
  const [reasons, setReasons] = useState<Record<number, string>>({});

  if (error) return <ErrorLine message={error} />;
  if (!data) return <p className="text-sm text-gray-500">Loading...</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500">No community reviews yet.</p>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-500">
        A community review proves a wallet signed it, not that the person used the template. Hide reviews that are abusive or spam; hidden reviews stay on record here.
      </p>

      {data.items.map((review: AdminUserReview) => {
        const reason = reasons[review.id] ?? "";

        return (
          <div key={review.id} className={card}>
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="font-semibold text-amber-400">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              <Link to={`/t/${review.identifier}`} className="font-mono text-[11px] text-gray-400 underline decoration-white/20 hover:text-amber-400">
                {review.identifier.slice(0, 12)}…
              </Link>
              <span className="text-gray-500">{when(review.created_at)}</span>
              <span className="font-mono text-[10px] text-gray-600">{review.reviewer.slice(0, 10)}…</span>
              {review.hidden ? <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-rose-300">hidden</span> : null}
            </div>

            <p className="mt-3 break-words text-sm text-gray-300">{review.body}</p>

            {review.hidden ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
                <span className="min-w-0 break-words">Hidden: {review.hidden_reason}</span>
                <button type="button" className={smallButton} onClick={() => void act(() => unhideUserReview(token, review.id), "Review is visible again.")}>
                  Unhide
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  aria-label={`Reason for hiding review ${review.id}`}
                  className={field}
                  value={reason}
                  onChange={(event) => setReasons((previous) => ({ ...previous, [review.id]: event.target.value }))}
                  placeholder="Reason for hiding (3+ characters)"
                />
                <button
                  type="button"
                  className={`${smallButton} shrink-0`}
                  disabled={reason.trim().length < 3}
                  onClick={() => void act(() => hideUserReview(token, review.id, reason.trim()), "Review hidden.")}
                >
                  Hide
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
