
import {
  ShieldCheck,
  LockKeyhole,
  ArrowLeft,
  Wallet,
  Users,
  Blocks,
  Activity,
  FileCheck2,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";

import { Link } from "react-router-dom";
import xogridlogo from "../assets/images/xogridlogo.png";
import { isAdminAccessConfigured } from "../config/admin";

const adminSections = [
  {
    label: "User Management",
    description: "Manage registered platform users",
    icon: Users,
  },
  {
    label: "Template Registry",
    description: "Review and manage published templates",
    icon: Blocks,
  },
  {
    label: "Verification",
    description: "Monitor automated template checks",
    icon: ShieldCheck,
  },
  {
    label: "Community Reports",
    description: "Review submitted community flags",
    icon: FileCheck2,
  },
];

export default function Admin() {
  const configured = isAdminAccessConfigured();

  return (
    <main className="admin-page relative min-h-screen overflow-hidden bg-[#05070B] text-white">
      <style>{`
        @keyframes adminFadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes adminFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes adminSlideDown {
          from {
            opacity: 0;
            transform: translateY(-18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes adminGlow {
          0%, 100% {
            opacity: .35;
            transform: scale(1);
          }
          50% {
            opacity: .7;
            transform: scale(1.12);
          }
        }

        @keyframes adminPulse {
          0%, 100% { opacity: .55; }
          50% { opacity: 1; }
        }

        @keyframes adminShine {
          from { transform: translateX(-150%); }
          to { transform: translateX(250%); }
        }

        .admin-header {
          animation: adminSlideDown .7s ease both;
        }

        .admin-intro {
          animation: adminFadeUp .8s ease .1s both;
        }

        .admin-status {
          animation: adminFadeUp .8s ease .2s both;
        }

        .admin-card {
          opacity: 0;
          animation: adminFadeUp .7s ease forwards;
          transition:
            transform .35s ease,
            border-color .35s ease,
            background .35s ease,
            box-shadow .35s ease;
        }

        .admin-card:hover {
          transform: translateY(-6px);
          border-color: rgba(245, 158, 11, .35);
          background: #10151d;
          box-shadow: 0 16px 45px rgba(0, 0, 0, .25),
                      0 0 25px rgba(245, 158, 11, .045);
        }

        .admin-icon {
          transition: transform .35s ease, background .35s ease;
        }

        .admin-card:hover .admin-icon {
          transform: rotate(-7deg) scale(1.08);
          background: rgba(245, 158, 11, .13);
        }

        .admin-module {
          opacity: 0;
          animation: adminFadeUp .7s ease forwards;
          transition:
            transform .3s ease,
            border-color .3s ease,
            box-shadow .3s ease;
        }

        .admin-module:hover {
          transform: translateY(-4px);
          border-color: rgba(245, 158, 11, .35);
          box-shadow: 0 12px 35px rgba(0, 0, 0, .2);
        }

        .admin-module:hover .module-arrow {
          opacity: 1;
          transform: translate(2px, -2px);
        }

        .module-arrow {
          opacity: 0;
          transition: all .3s ease;
        }

        .admin-ambient {
          animation: adminGlow 8s ease-in-out infinite;
        }

        .admin-status-dot {
          animation: adminPulse 2s ease-in-out infinite;
        }

        .admin-shine {
          position: relative;
          overflow: hidden;
        }

        .admin-shine::after {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          width: 35%;
          height: 100%;
          background: linear-gradient(
            90deg,
            transparent,
            rgba(255,255,255,.035),
            transparent
          );
          transform: translateX(-150%);
          animation: adminShine 7s ease-in-out infinite;
          pointer-events: none;
        }

        .admin-grid-bg {
          background-image:
            linear-gradient(rgba(255,255,255,.018) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,.018) 1px, transparent 1px);
          background-size: 55px 55px;
          mask-image: linear-gradient(to bottom, black, transparent 85%);
        }

        @media (prefers-reduced-motion: reduce) {
          .admin-page *,
          .admin-page *::before,
          .admin-page *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }

          .admin-card,
          .admin-module {
            opacity: 1;
          }
        }
      `}</style>

      {/* Background Effects */}
      <div className="admin-grid-bg pointer-events-none absolute inset-0" />

      <div className="admin-ambient pointer-events-none absolute -left-40 top-32 h-[420px] w-[420px] rounded-full bg-amber-500/[0.055] blur-[120px]" />

      <div className="admin-ambient pointer-events-none absolute -right-40 top-[500px] h-[400px] w-[400px] rounded-full bg-orange-500/[0.035] blur-[120px]" />

      {/* Fixed Top Navigation */}
      <header className="admin-header fixed inset-x-0 top-0 z-50 border-b border-white/[0.07] bg-[#0B0E13]/90 shadow-lg shadow-black/20 backdrop-blur-2xl">
        <div className="mx-auto flex h-[76px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="group flex items-center gap-3">
            <img
              src={xogridlogo}
              alt="XOGrid"
              className="h-9 w-auto object-contain transition duration-300 group-hover:scale-105"
            />

            <span className="hidden border-l border-white/10 pl-3 text-xs font-medium tracking-wider text-gray-400 transition group-hover:text-amber-400 sm:block">
              ADMINISTRATION
            </span>
          </Link>

          <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2 transition hover:border-amber-500/40">
            <span className="admin-status-dot h-2 w-2 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,.65)]" />

            <span className="text-xs font-medium text-amber-400">
              {configured ? "Authentication pending" : "Setup pending"}
            </span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-[116px] sm:px-8 lg:pb-16 lg:pt-[132px]">
        {/* Page Heading */}
        <div className="admin-intro mb-10">
          <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-gray-500">
            <Activity size={14} className="text-amber-500" />

            Control Center

            <span className="text-gray-700">/</span>

            Admin Access
          </div>

          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Sparkles size={16} className="text-amber-500" />

                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-amber-500">
                  Private Control Center
                </span>
              </div>

              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl">
                Administration
                <span className="text-amber-500">.</span>
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-6 text-gray-400">
                Manage the XOGrid template registry, platform activity,
                verification processes and community contributions.
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 py-3 sm:flex">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
                <ShieldCheck size={17} className="text-amber-500" />
              </div>

              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-500">
                  Security level
                </p>
                <p className="mt-0.5 text-xs font-semibold text-white">
                  Restricted access
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Access Status */}
        <section className="admin-status admin-shine mb-10 overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0D1117] shadow-[0_20px_70px_rgba(0,0,0,.18)]">
          <div className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/[0.07] shadow-[0_0_25px_rgba(245,158,11,.07)]">
                {configured ? (
                  <Wallet size={22} className="text-amber-500" />
                ) : (
                  <LockKeyhole size={22} className="text-amber-500" />
                )}
              </div>

              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-lg font-semibold">
                    Administrator authorization
                  </h2>

                  <span className="rounded-md border border-amber-500/20 bg-amber-500/[0.08] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
                    {configured
                      ? "Pending verification"
                      : "Not configured"}
                  </span>
                </div>

                <p className="mt-2 max-w-xl text-sm leading-6 text-gray-400">
                  {configured
                    ? "The administrator addresses are configured. Wallet ownership verification and backend authorization are still required."
                    : "The three authorized administrator wallet addresses have not been added yet. This control center is awaiting initial setup."}
                </p>
              </div>
            </div>

            <div className="shrink-0 rounded-xl border border-white/[0.08] bg-black/20 px-5 py-4 transition hover:border-amber-500/20">
              <p className="text-xs text-gray-500">
                Authorized administrators
              </p>

              <p className="mt-1 text-2xl font-semibold tabular-nums">
                0{" "}
                <span className="text-sm font-normal text-gray-500">
                  / 3
                </span>
              </p>
            </div>
          </div>

          <div className="border-t border-white/[0.07] bg-black/10 px-6 py-4 sm:px-8">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <ShieldCheck size={15} className="text-amber-500" />

              Access is reserved for three approved administrator wallets.
            </div>
          </div>
        </section>

        {/* Authorized Administrators */}
        <section className="mb-12">
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-[3px] rounded-full bg-amber-500" />

              <h2 className="text-base font-semibold">
                Authorized administrators
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Three designated accounts will manage the platform.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((admin, index) => (
              <div
                key={admin}
                style={{ animationDelay: `${0.15 + index * 0.15}s` }}
                className="admin-card group relative overflow-hidden rounded-xl border border-white/[0.08] bg-[#0D1117] p-5"
              >
                <div className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-500/[0.035] blur-2xl transition group-hover:bg-amber-500/[0.09]" />

                <div className="relative mb-5 flex items-center justify-between">
                  <div className="admin-icon flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/[0.06]">
                    <Wallet size={18} className="text-amber-500" />
                  </div>

                  <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-gray-500">
                    Awaiting setup
                  </span>
                </div>

                <div className="relative">
                  <h3 className="text-sm font-semibold transition-colors group-hover:text-amber-400">
                    Administrator {admin}
                  </h3>

                  <p className="mt-2 break-all text-xs text-gray-500">
                    Wallet address not added
                  </p>

                  <div className="mt-5 border-t border-white/[0.07] pt-4">
                    <span className="text-xs text-gray-600">
                      Access permissions pending
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Administration Modules */}
        <section>
          <div className="mb-5">
            <div className="mb-2 flex items-center gap-2">
              <div className="h-5 w-[3px] rounded-full bg-amber-500" />

              <h2 className="text-base font-semibold">
                Administration modules
              </h2>
            </div>

            <p className="text-sm text-gray-500">
              Platform management tools planned for the control center.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {adminSections.map((section, index) => {
              const Icon = section.icon;

              return (
                <div
                  key={section.label}
                  style={{ animationDelay: `${0.3 + index * 0.12}s` }}
                  className="admin-module group flex items-center gap-4 rounded-xl border border-white/[0.08] bg-[#0D1117] p-5"
                >
                  <div className="admin-icon flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-amber-500/15 bg-amber-500/[0.06]">
                    <Icon size={19} className="text-amber-500" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold transition-colors group-hover:text-amber-400">
                      {section.label}
                    </h3>

                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {section.description}
                    </p>
                  </div>

                  <ArrowUpRight
                    size={17}
                    className="module-arrow shrink-0 text-amber-500"
                  />
                </div>
              );
            })}
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-14 flex flex-col gap-4 border-t border-white/[0.07] pt-7 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-medium text-gray-400">
              XOGrid Administration
            </p>

            <p className="mt-1 text-[11px] text-gray-600">
              Private Control Center · Restricted Access
            </p>
          </div>

          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm font-medium text-gray-400 transition hover:text-amber-400"
          >
            <ArrowLeft
              size={16}
              className="transition-transform group-hover:-translate-x-1"
            />

            Return to XOGrid
          </Link>
        </footer>
      </div>
    </main>
  );
}
