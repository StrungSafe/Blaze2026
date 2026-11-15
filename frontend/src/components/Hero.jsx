
import { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Fingerprint,
  ShieldCheck,
  Layers3,
  Sparkles,
} from "lucide-react";

const typingWords = [
  "XO templates.",
  "Wallet templates.",
  "Open templates.",
];

function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Typing animation
  useEffect(() => {
    const currentWord = typingWords[wordIndex];

    const delay = isDeleting ? 45 : text === currentWord ? 1500 : 95;

    if (isDeleting && text === "") {
      const timeout = setTimeout(() => {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % typingWords.length);
      }, 300);

      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      if (!isDeleting && text === currentWord) {
        setIsDeleting(true);
      } else {
        setText((prev) =>
          isDeleting
            ? prev.slice(0, -1)
            : currentWord.slice(0, prev.length + 1)
        );
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex]);

  return (
    <section
      id="home"
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-5 pb-20  md:pt-32 text-white sm:px-8"
    >
      <style>{`
        @keyframes xo-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes xo-orbit-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes xo-float {
          0%, 100% { transform: translate3d(0, 0, 0); }
          50% { transform: translate3d(0, -18px, 0); }
        }

        @keyframes xo-glow {
          0%, 100% { opacity: .35; transform: scale(.9); }
          50% { opacity: .8; transform: scale(1.15); }
        }

        @keyframes xo-reveal {
          from {
            opacity: 0;
            transform: translateY(35px);
            filter: blur(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes xo-light-trail {
          0% { stroke-dashoffset: 800; opacity: 0; }
          15% { opacity: .8; }
          85% { opacity: .8; }
          100% { stroke-dashoffset: 0; opacity: 0; }
        }

        @keyframes xo-particle {
          0%, 100% {
            opacity: .15;
            transform: translateY(0) scale(.7);
          }
          50% {
            opacity: 1;
            transform: translateY(-22px) scale(1.3);
          }
        }

        @keyframes xo-scroll {
          0% { transform: translateY(-5px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(8px); opacity: 0; }
        }

        @keyframes xo-cursor {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        .xo-orbit {
          animation: xo-orbit 35s linear infinite;
        }

        .xo-orbit-reverse {
          animation: xo-orbit-reverse 48s linear infinite;
        }

        .xo-glow {
          animation: xo-glow 7s ease-in-out infinite;
        }

        .xo-reveal {
          animation: xo-reveal .9s cubic-bezier(.2,.7,.2,1) both;
        }

        .xo-trail {
          stroke-dasharray: 100 700;
          animation: xo-light-trail 9s linear infinite;
        }

        .xo-particle {
          animation: xo-particle 5s ease-in-out infinite;
        }

        .xo-scroll {
          animation: xo-scroll 1.8s ease-in-out infinite;
        }

        .xo-cursor {
          display: inline-block;
          margin-left: 5px;
       color: #fb923c;
          animation: xo-cursor .8s steps(1) infinite;
        }

        .xo-delay-1 { animation-delay: .15s; }
        .xo-delay-2 { animation-delay: .3s; }
        .xo-delay-3 { animation-delay: .45s; }
        .xo-delay-4 { animation-delay: .6s; }

        @media (prefers-reduced-motion: reduce) {
          .xo-orbit,
          .xo-orbit-reverse,
          .xo-glow,
          .xo-reveal,
          .xo-trail,
          .xo-particle,
          .xo-scroll,
          .xo-cursor {
            animation: none !important;
          }
        }
      `}</style>

      {/* ANIMATED BACKGROUND EFFECTS */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">

        {/* Central light */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(104,61,190,0.16),transparent_60%)]" />

        {/* Purple glow */}
        <div className="xo-glow absolute -left-40 top-[15%] h-[450px] w-[450px] rounded-full bg-violet-700/20 blur-[150px]" />

        <div className="xo-glow absolute -right-40 top-[20%] h-[450px] w-[450px] rounded-full bg-indigo-600/20 blur-[150px]" />

        <div className="absolute bottom-[-250px] left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-purple-700/10 blur-[150px]" />

        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.07) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.07) 1px, transparent 1px)
            `,
            backgroundSize: "70px 70px",
            maskImage:
              "radial-gradient(ellipse at center, black 10%, transparent 75%)",
          }}
        />

        {/* Orbital geometry */}
        <div className="absolute left-1/2 top-1/2 h-[580px] w-[580px] -translate-x-1/2 -translate-y-1/2 sm:h-[760px] sm:w-[760px] lg:h-[900px] lg:w-[900px]">
          <div className="xo-orbit absolute inset-0 rounded-full border border-violet-400/[0.10]">
            <span className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 rounded-full bg-violet-300 shadow-[0_0_25px_8px_rgba(167,139,250,.55)]" />
          </div>

          <div className="xo-orbit-reverse absolute inset-[10%] rounded-full border border-indigo-400/[0.10]">
            <span className="absolute bottom-[12%] right-[5%] h-2 w-2 rounded-full bg-indigo-300 shadow-[0_0_20px_6px_rgba(129,140,248,.5)]" />
          </div>

          <div className="xo-orbit absolute inset-[22%] rounded-full border border-purple-300/[0.12]">
            <span className="absolute right-[8%] top-[20%] h-1.5 w-1.5 rounded-full bg-purple-200 shadow-[0_0_16px_5px_rgba(192,132,252,.6)]" />
          </div>
        </div>

        {/* Animated energy paths */}
        <svg
          className="absolute inset-0 h-full w-full opacity-70"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          fill="none"
        >
          <defs>
            <linearGradient id="xoFlowOne">
              <stop offset="0%" stopColor="#7C3AED" stopOpacity="0" />
              <stop offset="50%" stopColor="#C4B5FD" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0" />
            </linearGradient>

            <linearGradient id="xoFlowTwo">
              <stop offset="0%" stopColor="#6366F1" stopOpacity="0" />
              <stop offset="50%" stopColor="#A78BFA" />
              <stop offset="100%" stopColor="#9333EA" stopOpacity="0" />
            </linearGradient>
          </defs>

          <path
            d="M-150 500 C180 100 360 850 720 450 S1200 150 1600 500"
            stroke="url(#xoFlowOne)"
            strokeWidth="1.5"
            className="xo-trail"
          />

          <path
            d="M-150 350 C250 750 400 100 780 500 S1250 750 1600 300"
            stroke="url(#xoFlowTwo)"
            strokeWidth="1.2"
            className="xo-trail"
            style={{ animationDelay: "3s" }}
          />

          <path
            d="M-150 700 C220 350 400 900 760 620 S1200 350 1600 650"
            stroke="url(#xoFlowOne)"
            strokeWidth="1"
            className="xo-trail"
            style={{ animationDelay: "5s" }}
          />
        </svg>

        {/* Floating particles */}
        {Array.from({ length: 24 }).map((_, index) => (
          <span
            key={index}
            className="xo-particle absolute h-1 w-1 rounded-full bg-violet-200 shadow-[0_0_12px_3px_rgba(167,139,250,.5)]"
            style={{
              left: `${(index * 37 + 9) % 100}%`,
              top: `${(index * 53 + 7) % 100}%`,
              animationDelay: `${(index % 7) * 0.6}s`,
              animationDuration: `${4 + (index % 4)}s`,
            }}
          />
        ))}
      </div>

      {/* HERO CONTENT */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">

        {/* Top label */}
        <div className="xo-reveal mb-9 inline-flex items-center gap-2 rounded-full border border-violet-300/20 bg-violet-500/[0.08] px-4 py-2.5 shadow-[0_0_35px_rgba(139,92,246,.08)] backdrop-blur-xl">
          <Sparkles size={15} className="text-violet-300" />

          <span className="text-[10px] font-semibold uppercase tracking-[0.19em] text-violet-200 sm:text-xs">
            The XO Template Registry
          </span>

          <span className="h-1 w-1 rounded-full bg-violet-300" />

          <span className="text-[10px] text-white/50 sm:text-xs">
            Explore the ecosystem
          </span>
        </div>

        {/* Main heading */}
        <h1 className="xo-reveal xo-delay-1 max-w-5xl text-[clamp(3.2rem,9vw,7.8rem)] font-semibold leading-[0.98] tracking-[-0.075em]">
          The home for
          <br />

          <span className="relative inline-block bg-gradient-to-r from-orange-300 via-orange-500 to-amber-300 bg-clip-text text-transparent">
  <span className="inline-block" aria-label={typingWords[wordIndex]}>
    {text}
  </span>

  <span
    className="xo-cursor text-orange-400"
    aria-hidden="true"
  >
    |
  </span>

  <span className="absolute -bottom-2 left-1/2 h-[3px] w-[55%] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-orange-400 to-transparent opacity-70 blur-[1px]" />
</span>

        </h1>

        {/* Description */}
        <p className="xo-reveal xo-delay-2 mt-8 max-w-2xl text-base leading-8 text-white/50 sm:text-lg sm:leading-9">
          Publish, discover and inspect XO wallet templates. Understand
          automated checks, community reviews and wallet policy decisions — all
          in one open registry.
        </p>

        {/* Action buttons */}
        <div className="xo-reveal xo-delay-3 mt-10 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
          <a
            href="/browse"
            className="group inline-flex items-center justify-center gap-3 rounded-xl bg-orange-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_12px_45px_rgba(249,115,22,.2)] transition-all duration-300 hover:-translate-y-1 hover:bg-orange-400 hover:shadow-[0_15px_50px_rgba(249,115,22,.35)]"
          >
            Explore the registry

            <ArrowRight
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </a>

          <a
            href="#how-it-works"
            className="group inline-flex items-center justify-center gap-3 rounded-xl border border-white/15 bg-white/[0.035] px-8 py-4 text-sm font-semibold text-white/85 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/40 hover:bg-violet-500/10"
          >
            How it works

            <ArrowUpRight
              size={17}
              className="text-violet-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </a>
        </div>

        {/* Product qualities */}
        <div className="xo-reveal xo-delay-4 mt-16 flex flex-wrap items-center justify-center gap-x-7 gap-y-5 border-t border-white/[0.08] px-3 pt-8 sm:gap-x-12">
          <div className="flex items-center gap-2.5 text-xs text-white/45">
            <Fingerprint size={16} className="text-violet-300" />
            Content-addressed IDs
          </div>

          <div className="flex items-center gap-2.5 text-xs text-white/45">
            <ShieldCheck size={16} className="text-violet-300" />
            Automated checks
          </div>

          <div className="flex items-center gap-2.5 text-xs text-white/45">
            <Layers3 size={16} className="text-violet-300" />
            Open registry
          </div>
        </div>
      </div>

      {/* Scroll indicator */}
      <a
        href="#how-it-works"
        aria-label="Scroll to the next section"
        className="group absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/30 transition-colors hover:text-violet-300"
      >
        <span className="text-[9px] mb-20 font-medium uppercase tracking-[0.25em]">
          Discover more
        </span>

        <ArrowDown size={16} className="xo-scroll" />
      </a>
    </section>
  );
}

export default Hero;
