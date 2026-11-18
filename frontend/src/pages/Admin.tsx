import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
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
import { publicKeyHex, signWithWallet } from "../hub/wallet";
import { useWallet } from "../hub/WalletContext";

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
    <main className="relative min-h-[calc(100vh-76px)] overflow-hidden bg-[#05070B] text-white">
      <style>{STYLE}</style>
      <div className="admin-grid-bg pointer-events-none absolute inset-0" />
      <div className="admin-ambient pointer-events-none absolute -left-40 top-32 h-[420px] w-[420px] rounded-full bg-amber-500/[0.055] blur-[120px] 2xl:h-[520px] 2xl:w-[520px]" />

      {/* Admin lives inside the shared DashboardLayout, which already provides the header and sidebar. */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 pt-6 sm:px-8 2xl:max-w-[1800px] 2xl:px-12 2xl:pt-8">
        {status ? (
          <div className="flex justify-end">
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 2xl:gap-3 2xl:px-4 2xl:py-3">
              <span className="h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.65)] 2xl:h-2.5 2xl:w-2.5" />
              <span className="text-xs font-medium text-amber-400 2xl:text-sm">{status}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-16 pt-8 sm:px-8 lg:pt-12 2xl:max-w-[1800px] 2xl:px-12 2xl:pb-20 2xl:pt-16">
        {children}

        <footer className="mt-14 flex items-center justify-between border-t border-white/[0.07] pt-7 2xl:mt-20 2xl:pt-9">
          <p className="text-[11px] text-gray-600 2xl:text-xs">
            XOGrid Administration · access is checked by the server on every request
          </p>
          <Link to="/" className="group inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-amber-400 2xl:gap-3 2xl:text-base">
            <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1 2xl:h-5 2xl:w-5" />
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
        <p className="flex items-center gap-2 text-sm text-gray-400 2xl:text-base">
          <Loader2 size={16} className="animate-spin 2xl:h-5 2xl:w-5" /> Checking your session...
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
  // The wallet is the site-wide connection (navbar / connect modal), so a moderator who already connected elsewhere is
  // ready to sign in without scanning again.
  const { session, connected, walletName, status, openModal } = useWallet();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [triedKey, setTriedKey] = useState("");

  async function signIn() {
    if (!session || !connected || busy) return;

    setBusy(true);
    setError("");
    setTriedKey("");

    try {
      const key = await publicKeyHex(session);

      setTriedKey(key);

      const challenge = await requestChallenge(key);

      if (!challenge.walletSignRequest) {
        throw new Error("The server did not return a signing request.");
      }

      const signedTransaction = await signWithWallet(session, challenge.walletSignRequest);
      const result = await submitLogin(challenge.nonce, signedTransaction);

      // The wallet stays connected for the rest of the site. Only the moderator session is new.
      onLogin(result.token, result.admin);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-fade max-w-xl 2xl:max-w-2xl">
      <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500 2xl:mb-4 2xl:text-xs">
        <ShieldCheck size={14} className="2xl:h-4 2xl:w-4" /> Private control center
      </div>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl 2xl:text-5xl">
        Moderator sign in<span className="text-amber-500">.</span>
      </h1>
      <p className="mt-3 text-sm leading-6 text-gray-400 2xl:mt-4 2xl:text-base 2xl:leading-7">
        Connect a WizardConnect wallet such as Selene. You sign a message-only transaction that is never broadcast and moves no funds.
        The server checks that the signing key is on its moderator list.
      </p>

      <div className="mt-8 rounded-2xl border border-white/[0.09] bg-[#0D1117] p-6 2xl:mt-10 2xl:p-8">
        {connected ? (
          <>
            <p className="flex items-center gap-2 text-xs text-emerald-300 2xl:text-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400 2xl:h-2.5 2xl:w-2.5" />
              Wallet connected: {walletName}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-3 2xl:mt-5 2xl:gap-4">
              <button
                type="button"
                onClick={signIn}
                disabled={busy}
                className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:opacity-50 2xl:gap-3 2xl:px-6 2xl:py-4 2xl:text-base"
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                {busy ? "Approve in your wallet..." : `Sign in with ${walletName}`}
              </button>

              <button
                type="button"
                onClick={openModal}
                disabled={busy}
                className="rounded-xl border border-white/10 px-4 py-3 text-xs font-medium text-white/70 transition hover:border-amber-500/40 hover:text-amber-300 disabled:opacity-50 2xl:px-5 2xl:py-4 2xl:text-sm"
              >
                Change wallet
              </button>
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={openModal}
              className="flex items-center gap-2 rounded-xl bg-amber-500 px-5 py-3 text-sm font-semibold text-black transition hover:bg-amber-400 2xl:gap-3 2xl:px-6 2xl:py-4 2xl:text-base"
            >
              <Wallet size={17} />
              Connect wallet
            </button>

            {status ? <p className="mt-3 text-xs text-gray-500 2xl:mt-4 2xl:text-sm">Relay: {status}</p> : null}
          </>
        )}

        {error ? (
          <div className="mt-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-xs text-rose-300 2xl:mt-6 2xl:p-5 2xl:text-sm">
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
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end 2xl:gap-8">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500 2xl:mb-4 2xl:text-xs">
            <ShieldCheck size={14} className="2xl:h-4 2xl:w-4" /> Private control center
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl 2xl:text-5xl">
            Administration<span className="text-amber-500">.</span>
          </h1>
        </div>
        <button type="button" onClick={onLogout} className={`${smallButton} inline-flex items-center gap-2 self-start 2xl:px-4 2xl:py-2.5 2xl:text-sm`}>
          <LogOut size={14} className="2xl:h-4 2xl:w-4" /> Sign out
        </button>
      </div>

      <nav className="mt-8 flex flex-wrap gap-2 2xl:mt-10 2xl:gap-3" aria-label="Administration sections">
        {TABS.map((item) => {
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              aria-current={tab === item.id ? "page" : undefined}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition 2xl:gap-3 2xl:px-5 2xl:py-3 2xl:text-sm ${
                tab === item.id
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-300"
                  : "border-white/[0.08] bg-white/[0.025] text-gray-400 hover:text-white"
              }`}
            >
              <Icon size={15} className="2xl:h-[18px] 2xl:w-[18px]" /> {item.label}
            </button>
          );
        })}
      </nav>

      {notice ? (
        <p
          role="status"
          className={`mt-5 rounded-xl border px-4 py-3 text-xs 2xl:mt-6 2xl:px-5 2xl:py-4 2xl:text-sm ${
            notice.ok ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300" : "border-rose-500/20 bg-rose-500/10 text-rose-300"
          }`}
        >
          {notice.text}
        </p>
      ) : null}

      <div className="mt-6 2xl:mt-8">
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

const card = "rounded-2xl border border-white/[0.09] bg-[#0D1117] p-5 2xl:p-7";
const when = (iso: string) => iso.slice(0, 16).replace("T", " ");

function ErrorLine({ message }: { message: string }) {
  return message ? <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-xs text-rose-300 2xl:px-5 2xl:py-4 2xl:text-sm">{message}</p> : null;
}

function OverviewTab({ token, version, onError }: TabProps) {
  const { data, error } = useTabData<AdminSummary>(() => adminSummary(token), [version], onError);

  if (error) return <ErrorLine message={error} />;
  if (!data) return <p className="text-sm text-gray-500 2xl:text-base">Loading...</p>;

  const stats = [
    { label: "Templates", value: data.templates.total - data.templates.removed, icon: Blocks },
    { label: "Open reports", value: data.openFlags, icon: Flag },
    { label: "Moderator reviews", value: data.reviews, icon: FileCheck2 },
    { label: "With failing checks", value: data.templates.withFailingChecks, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-8 2xl:space-y-10">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 2xl:gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <div key={stat.label} className={card}>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/[0.06] 2xl:h-12 2xl:w-12">
                <Icon size={18} className="text-amber-500 2xl:h-5 2xl:w-5" />
              </div>
              <p className="mt-4 text-3xl font-semibold tabular-nums 2xl:mt-5 2xl:text-4xl">{stat.value}</p>
              <p className="mt-1 text-xs text-gray-500 2xl:text-sm">{stat.label}</p>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 2xl:text-sm">
        Badges: {Object.entries(data.templates.byBadge).map(([badge, count]) => `${badge} ${count}`).join(" · ")}
        {data.templates.removed > 0 ? ` · removed ${data.templates.removed}` : ""}
      </p>

      <section>
        <h2 className="mb-3 text-base font-semibold 2xl:mb-4 2xl:text-lg">Recent moderator actions</h2>
        {data.recentActions.length === 0 ? (
          <p className="text-sm text-gray-500 2xl:text-base">No actions yet.</p>
        ) : (
          <ul className={`${card} divide-y divide-white/[0.06] p-0`}>
            {data.recentActions.map((action, index) => (
              <li key={index} className="flex flex-wrap gap-x-3 gap-y-1 px-5 py-3 text-xs 2xl:gap-x-4 2xl:px-7 2xl:py-4 2xl:text-sm">
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
  if (!data) return <p className="text-sm text-gray-500 2xl:text-base">Loading...</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500 2xl:text-base">No open reports.</p>;

  return (
    <div className="space-y-3 2xl:space-y-4">
      {data.items.map((flag: AdminFlag) => (
        <div key={flag.id} className={card}>
          <div className="flex flex-wrap items-start justify-between gap-3 2xl:gap-5">
            <div className="min-w-0">
              <Link to={`/t/${flag.identifier}`} className="text-sm font-semibold underline decoration-white/20 hover:text-amber-400 2xl:text-base">
                {flag.templateName}
              </Link>
              <p className="mt-2 break-words text-sm text-gray-300 2xl:mt-3 2xl:text-base">{flag.reason}</p>
              <p className="mt-2 text-[11px] text-gray-500 2xl:mt-3 2xl:text-xs">
                Reported {when(flag.createdAt)} by {flag.reporter}
              </p>
            </div>
            <div className="flex gap-2 2xl:gap-3">
              <button type="button" className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`} onClick={() => void act(() => resolveFlag(token, flag.id, "dismissed"), "Report dismissed.")}>
                Dismiss
              </button>
              <button type="button" className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`} onClick={() => void act(() => resolveFlag(token, flag.id, "upheld"), "Report upheld.")}>
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
        className="mb-4 flex gap-2 2xl:mb-6 2xl:gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setApplied(query);
        }}
      >
        <input aria-label="Search templates" className={`${field} 2xl:px-4 2xl:py-3 2xl:text-sm`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search by name, description or identifier" />
        <button type="submit" className={`${smallButton} 2xl:px-5 2xl:text-sm`}>
          Search
        </button>
      </form>

      <ErrorLine message={error} />
      {!data && !error ? <p className="text-sm text-gray-500 2xl:text-base">Loading...</p> : null}
      {data && data.items.length === 0 ? <p className="text-sm text-gray-500 2xl:text-base">No templates match.</p> : null}

      <div className="space-y-3 2xl:space-y-4">
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
      <div className="flex flex-wrap items-center gap-3 2xl:gap-4">
        <Link to={`/t/${template.identifier}`} className="text-sm font-semibold underline decoration-white/20 hover:text-amber-400 2xl:text-base">
          {template.name}
        </Link>
        <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] uppercase tracking-wider text-gray-400 2xl:px-3 2xl:py-1.5 2xl:text-xs">
          {template.removed ? "removed" : template.badge}
        </span>
        {template.openFlags > 0 ? <span className="text-[11px] text-amber-400 2xl:text-xs">{template.openFlags} open report{template.openFlags === 1 ? "" : "s"}</span> : null}
        <span className="ml-auto break-all font-mono text-[10px] text-gray-600 2xl:text-xs">{template.identifier.slice(0, 16)}…</span>
      </div>

      {template.removed ? (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 2xl:mt-4 2xl:gap-4 2xl:text-sm">
          <span className="min-w-0 break-words">Removed: {template.removedReason}</span>
          <button type="button" className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`} onClick={() => void act(() => restoreTemplate(token, template.identifier), "Template restored.")}>
            Restore
          </button>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row 2xl:mt-4 2xl:gap-3">
          <input
            aria-label={`Note for ${template.name}`}
            className={`${field} 2xl:px-4 2xl:py-3 2xl:text-sm`}
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Type a note first: review note, removal reason or featured blurb (3+ characters)"
          />
          <div className="flex shrink-0 gap-2 2xl:gap-3">
            <button
              type="button"
              className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`}
              disabled={!ready}
              onClick={() =>
                void act(() => reviewTemplate(token, template.identifier, note.trim()), "Review recorded.").then((ok) => ok && setNote(""))
              }
            >
              Review
            </button>
            <button
              type="button"
              className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`}
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
              className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`}
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
  if (!data) return <p className="text-sm text-gray-500 2xl:text-base">Loading...</p>;
  if (data.items.length === 0) return <p className="text-sm text-gray-500 2xl:text-base">No community reviews yet.</p>;

  return (
    <div className="space-y-3 2xl:space-y-4">
      <p className="text-xs text-gray-500 2xl:text-sm">
        A community review proves a wallet signed it, not that the person used the template. Hide reviews that are abusive or spam; hidden reviews stay on record here.
      </p>

      {data.items.map((review: AdminUserReview) => {
        const reason = reasons[review.id] ?? "";

        return (
          <div key={review.id} className={card}>
            <div className="flex flex-wrap items-center gap-3 text-xs 2xl:gap-4 2xl:text-sm">
              <span className="font-semibold text-amber-400">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</span>
              <Link to={`/t/${review.identifier}`} className="font-mono text-[11px] text-gray-400 underline decoration-white/20 hover:text-amber-400 2xl:text-xs">
                {review.identifier.slice(0, 12)}…
              </Link>
              <span className="text-gray-500">{when(review.created_at)}</span>
              <span className="font-mono text-[10px] text-gray-600 2xl:text-xs">{review.reviewer.slice(0, 10)}…</span>
              {review.hidden ? <span className="rounded-md border border-rose-500/20 bg-rose-500/10 px-2 py-1 text-[10px] uppercase tracking-wider text-rose-300 2xl:px-3 2xl:py-1.5 2xl:text-xs">hidden</span> : null}
            </div>

            <p className="mt-3 break-words text-sm text-gray-300 2xl:mt-4 2xl:text-base">{review.body}</p>

            {review.hidden ? (
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400 2xl:mt-4 2xl:gap-4 2xl:text-sm">
                <span className="min-w-0 break-words">Hidden: {review.hidden_reason}</span>
                <button type="button" className={`${smallButton} 2xl:px-4 2xl:py-2 2xl:text-sm`} onClick={() => void act(() => unhideUserReview(token, review.id), "Review is visible again.")}>
                  Unhide
                </button>
              </div>
            ) : (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row 2xl:mt-4 2xl:gap-3">
                <input
                  aria-label={`Reason for hiding review ${review.id}`}
                  className={`${field} 2xl:px-4 2xl:py-3 2xl:text-sm`}
                  value={reason}
                  onChange={(event) => setReasons((previous) => ({ ...previous, [review.id]: event.target.value }))}
                  placeholder="Reason for hiding (3+ characters)"
                />
                <button
                  type="button"
                  className={`${smallButton} shrink-0 2xl:px-4 2xl:py-2 2xl:text-sm`}
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