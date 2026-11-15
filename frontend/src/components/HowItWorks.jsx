
import {
  Search,
  ScanSearch,
  ShieldCheck,
  ArrowUpRight,
  CheckCircle2,
  Fingerprint,
  FileCheck2,
  Scale,
} from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Discover",
    description:
      "Explore an open registry of XO wallet templates. Find templates for wallets, payments, security and more.",
    icon: Search,
    label: "Explore the registry",
    details: ["Browse published templates", "Search by name or category"],
  },
  {
    number: "02",
    title: "Inspect",
    description:
      "Understand what a template does. Examine its content-addressed ID, automated checks, flags and community reviews.",
    icon: ScanSearch,
    label: "Understand each template",
    details: ["Inspect audit results", "Read community feedback"],
  },
  {
    number: "03",
    title: "Evaluate & use",
    description:
      "Preview how your wallet trust policy treats a template before using it in your own workflow.",
    icon: ShieldCheck,
    label: "Make informed decisions",
    details: ["Preview policy decisions", "Use templates in your workflow"],
  },
];

const principles = [
  {
    icon: Fingerprint,
    title: "Unique identities",
    description: "Every template gets a content-addressed identifier.",
  },
  {
    icon: FileCheck2,
    title: "Transparent checks",
    description: "See automated results instead of unsupported claims.",
  },
  {
    icon: Scale,
    title: "Your policy, your decision",
    description: "Evaluate templates using your own trust requirements.",
  },
];

function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="relative isolate overflow-hidden px-5 py-24 text-white sm:px-8 lg:py-32"
    >
      <style>{`
        @keyframes how-pulse {
          0%, 100% {
            opacity: .3;
            transform: scale(.85);
          }
          50% {
            opacity: 1;
            transform: scale(1.2);
          }
        }

        @keyframes how-flow {
          to {
            stroke-dashoffset: -180;
          }
        }

        @keyframes how-glow {
          0%, 100% {
            opacity: .25;
          }
          50% {
            opacity: .7;
          }
        }

        .how-pulse {
          animation: how-pulse 3s ease-in-out infinite;
        }

        .how-flow-line {
          stroke-dasharray: 9 13;
          animation: how-flow 9s linear infinite;
        }

        .how-glow {
          animation: how-glow 5s ease-in-out infinite;
        }

        .how-card {
          transition:
            transform .4s ease,
            border-color .4s ease,
            background .4s ease,
            box-shadow .4s ease;
        }

        .how-card:hover {
          transform: translateY(-9px);
          border-color: rgba(167, 139, 250, .38);
          background: rgba(139, 92, 246, .055);
          box-shadow: 0 25px 75px rgba(109, 40, 217, .12);
        }

        @media (prefers-reduced-motion: reduce) {
          .how-pulse,
          .how-flow-line,
          .how-glow {
            animation: none !important;
          }

          .how-card {
            transition: none !important;
          }

          .how-card:hover {
            transform: none;
          }
        }
      `}</style>

      {/* Ambient lighting */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="how-glow absolute left-1/2 top-20 h-72 w-[650px] -translate-x-1/2 rounded-full bg-violet-600/[0.09] blur-[130px]" />

        <div className="absolute -right-40 top-1/2 h-80 w-80 rounded-full bg-indigo-600/[0.07] blur-[120px]" />

        <div className="absolute -left-40 bottom-0 h-80 w-80 rounded-full bg-purple-600/[0.06] blur-[120px]" />
      </div>

      <div className="mx-auto max-w-7xl">

        {/* SECTION HEADING */}
        <div className="mx-auto mb-16 max-w-3xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.07] px-4 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(167,139,250,.9)]" />

            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-200 sm:text-xs">
              Simple by design
            </span>
          </div>

          <h2 className="text-4xl font-semibold tracking-[-0.055em] sm:text-5xl lg:text-6xl">
            How XOGrid{" "}
            <span className="bg-gradient-to-r from-violet-300 via-purple-400 to-indigo-300 bg-clip-text text-transparent">
              works.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/45 sm:text-base sm:leading-8">
            From discovering wallet templates to understanding their behavior
            and evaluating them against your own policy. XOGrid makes the
            process transparent.
          </p>
        </div>

        {/* DIAGONAL WORKFLOW */}
        <div className="relative pb-0 md:pb-24">

          {/* Curved animated flow - desktop only */}
          <div className="pointer-events-none absolute inset-0 z-0 hidden md:block">
            <svg
              viewBox="0 0 1200 520"
              preserveAspectRatio="none"
              className="h-full w-full overflow-visible"
              fill="none"
            >
              <defs>
                <linearGradient
                  id="howFlowGradient"
                  x1="0%"
                  y1="0%"
                  x2="100%"
                  y2="100%"
                >
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.15" />
                  <stop offset="45%" stopColor="#C4B5FD" stopOpacity="0.9" />
                  <stop offset="100%" stopColor="#6366F1" stopOpacity="0.2" />
                </linearGradient>

                <filter id="howFlowGlow">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>

              {/* First curved connection */}
              <path
                d="M 365 65 C 390 65, 390 110, 415 110"
                stroke="url(#howFlowGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#howFlowGlow)"
              />

              {/* Second curved connection */}
              <path
                d="M 765 110 C 790 110, 790 155, 815 155"
                stroke="url(#howFlowGradient)"
                strokeWidth="2"
                strokeLinecap="round"
                filter="url(#howFlowGlow)"
              />

              {/* Moving light along the curves */}
              <path
                d="M 365 65 C 390 65, 390 110, 415 110 M 765 110 C 790 110, 790 155, 815 155"
                className="how-flow-line"
                stroke="#C4B5FD"
                strokeWidth="2.5"
                strokeLinecap="round"
                opacity="0.9"
              />

              {/* Connection points */}
              <circle cx="365" cy="65" r="4" fill="#A78BFA" />
              <circle cx="415" cy="110" r="4" fill="#C4B5FD" />
              <circle cx="765" cy="110" r="4" fill="#A78BFA" />
              <circle cx="815" cy="155" r="4" fill="#818CF8" />

              <circle
                cx="365"
                cy="65"
                r="9"
                fill="#A78BFA"
                opacity=".18"
                className="how-pulse"
              />
              <circle
                cx="815"
                cy="155"
                r="9"
                fill="#818CF8"
                opacity=".18"
                className="how-pulse"
                style={{ animationDelay: "1.5s" }}
              />
            </svg>
          </div>

          {/* Cards */}
          <div className="relative z-10 grid grid-cols-1 gap-7 md:grid-cols-3 md:gap-6">

            {steps.map((step, index) => {
              const Icon = step.icon;

              return (
                <article
                  key={step.number}
                  className={`
                    how-card group relative rounded-2xl border
                    border-white/[0.09] bg-white/[0.018]
                    p-7 backdrop-blur-sm sm:p-8
                    ${index === 0 ? "md:translate-y-0" : ""}
                    ${index === 1 ? "md:translate-y-12" : ""}
                    ${index === 2 ? "md:translate-y-24" : ""}
                  `}
                >
                  {/* Number and icon */}
                  <div className="relative z-10 mb-9 flex items-center justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/[0.10] text-violet-200 shadow-[0_0_30px_rgba(139,92,246,.08)] transition-all duration-300 group-hover:border-violet-300/40 group-hover:bg-violet-500/[0.16]">
                      <Icon size={22} strokeWidth={1.7} />
                    </div>

                    <span className="font-mono text-sm tracking-widest text-white/25">
                      / {step.number}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-2xl font-semibold tracking-tight text-white sm:text-[26px]">
                    {step.title}
                  </h3>

                  {/* Description */}
                  <p className="mt-4 min-h-[100px] text-sm leading-7 text-white/45">
                    {step.description}
                  </p>

                  {/* Details */}
                  <div className="mt-7 space-y-3 border-t border-white/[0.08] pt-6">
                    {step.details.map((detail) => (
                      <div
                        key={detail}
                        className="flex items-center gap-3 text-xs text-white/55"
                      >
                        <CheckCircle2
                          size={15}
                          className="shrink-0 text-violet-300/75"
                        />

                        {detail}
                      </div>
                    ))}
                  </div>

                  {/* Bottom label */}
                  <div className="mt-8 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-violet-300/75">
                      {step.label}
                    </span>

                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 text-white/40 transition-all duration-300 group-hover:border-violet-300/30 group-hover:bg-violet-400/10 group-hover:text-violet-200">
                      <ArrowUpRight size={15} />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* PRINCIPLES */}
        <div className="mt-20 border-t border-white/[0.08] pt-12">
          <div className="mb-9 text-center">
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
              Built around transparency
            </span>
          </div>

          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 sm:gap-6">
            {principles.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="flex items-start gap-4"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-300/15 bg-violet-500/[0.07] text-violet-300">
                    <Icon size={18} />
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white/85">
                      {item.title}
                    </h4>

                    <p className="mt-2 text-xs leading-6 text-white/40">
                      {item.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* BOTTOM CTA */}
        <div className="mt-20 flex flex-col items-center justify-between gap-6 rounded-2xl border border-violet-300/15 bg-violet-500/[0.045] p-7 text-center sm:flex-row sm:p-9 sm:text-left">
          <div>
            <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">
              Ready to explore the registry?
            </h3>

            <p className="mt-2 text-sm text-white/45">
              Discover what the XO ecosystem has to offer.
            </p>
          </div>

          <a
            href="/browse"
            className="group inline-flex shrink-0 items-center justify-center gap-3 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-[0_10px_35px_rgba(249,115,22,.16)] transition-all duration-300 hover:-translate-y-1 hover:bg-orange-400 hover:shadow-[0_12px_40px_rgba(249,115,22,.3)]"
          >
            Explore templates

            <ArrowUpRight
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </a>
        </div>
      </div>
    </section>
  );
}

export default HowItWorks;
