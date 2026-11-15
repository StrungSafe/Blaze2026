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
import { Link } from "react-router-dom";

const typingWords = ["XO templates.", "Wallet templates.", "Open templates."];

function Hero() {
  const [wordIndex, setWordIndex] = useState(0);
  const [text, setText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  // Typing animation
  useEffect(() => {
    const currentWord = typingWords[wordIndex];

    const delay = isDeleting ? 45 : text === currentWord ? 1800 : 95;

    const timeout = setTimeout(() => {
      if (!isDeleting && text === currentWord) {
        setIsDeleting(true);
      } else if (isDeleting && text === "") {
        setIsDeleting(false);
        setWordIndex((prev) => (prev + 1) % typingWords.length);
      } else {
        setText((prev) =>
          isDeleting
            ? prev.slice(0, -1)
            : currentWord.slice(0, prev.length + 1),
        );
      }
    }, delay);

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex]);

  return (
    <section
      id="home"
      className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-5 pb-24 pt-32 text-white sm:px-8 lg:pt-36"
    >
      <style>{`
        @keyframes xo-circle-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @keyframes xo-circle-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }

        @keyframes xo-circle-pulse {
          0%, 100% { transform: scale(.985); }
          50% { transform: scale(1.015); }
        }

        @keyframes xo-circle-glow {
          0%, 100% {
            box-shadow: 0 0 15px rgba(139,92,246,.04);
          }
          50% {
            box-shadow: 0 0 35px rgba(139,92,246,.16);
          }
        }

        @keyframes xo-reveal {
          from {
            opacity: 0;
            transform: translateY(25px);
            filter: blur(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
            filter: blur(0);
          }
        }

        @keyframes xo-scroll {
          0% { transform: translateY(-4px); opacity: .3; }
          50% { opacity: 1; }
          100% { transform: translateY(8px); opacity: .3; }
        }

        @keyframes xo-cursor {
          0%, 45% { opacity: 1; }
          46%, 100% { opacity: 0; }
        }

        .xo-circle-rotate {
          animation: xo-circle-rotate 38s linear infinite;
        }

        .xo-circle-reverse {
          animation: xo-circle-reverse 52s linear infinite;
        }

        .xo-circle-pulse {
          animation: xo-circle-pulse 10s ease-in-out infinite;
        }

        .xo-circle-glow {
          animation: xo-circle-glow 7s ease-in-out infinite;
        }

        .xo-reveal {
          animation: xo-reveal .9s cubic-bezier(.2,.7,.2,1) both;
        }

        .xo-delay-1 { animation-delay: .15s; }
        .xo-delay-2 { animation-delay: .3s; }
        .xo-delay-3 { animation-delay: .45s; }
        .xo-delay-4 { animation-delay: .6s; }

        .xo-cursor {
          display: inline-block;
          margin-left: 5px;
          color: #fb923c;
          animation: xo-cursor .8s steps(1) infinite;
        }

        .xo-scroll {
          animation: xo-scroll 1.8s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .xo-circle-rotate,
          .xo-circle-reverse,
          .xo-circle-pulse,
          .xo-circle-glow,
          .xo-reveal,
          .xo-cursor,
          .xo-scroll {
            animation: none !important;
          }
        }
      `}</style>

      {/* BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Central ambient lighting */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_45%,rgba(104,61,190,0.16),transparent_65%)]" />

        {/* Purple lighting */}
        <div className="absolute -left-48 top-[10%] h-[450px] w-[450px] rounded-full bg-violet-700/20 blur-[150px]" />

        {/* Orange lighting */}
        <div className="absolute -right-48 top-[15%] h-[450px] w-[450px] rounded-full bg-orange-600/10 blur-[150px]" />

        {/* Subtle background grid */}
        <div
          className="absolute inset-0 opacity-70"
          style={{
            backgroundImage: `
              linear-gradient(rgba(255,255,255,.035) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,.035) 1px, transparent 1px)
            `,
            backgroundSize: "70px 70px",
            maskImage:
              "radial-gradient(ellipse at center, black 5%, transparent 78%)",
          }}
        />

        {/* LARGE ANIMATED CIRCLE */}
        <div className="absolute left-1/2 top-1/2 h-[680px] w-[680px] -translate-x-1/2 -translate-y-1/2 sm:h-[900px] sm:w-[900px] lg:h-[1100px] lg:w-[1100px]">
          {/* Main circle */}
          <div className="xo-circle-pulse absolute inset-0 rounded-full border border-violet-400/20 shadow-[inset_0_0_100px_rgba(139,92,246,.06),0_0_100px_rgba(139,92,246,.08)]" />

          {/* Inner circle */}
          <div className="absolute inset-[9%] rounded-full border border-indigo-400/15" />

          {/* Outer rotating ring */}
          <div className="xo-circle-rotate absolute inset-0 rounded-full">
            <div className="absolute left-1/2 top-0 h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-orange-400 shadow-[0_0_18px_5px_rgba(251,146,60,.55)]" />
          </div>

          {/* Inner rotating ring */}
          <div className="xo-circle-reverse absolute inset-[9%] rounded-full">
            <div className="absolute bottom-[8%] left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-violet-300 shadow-[0_0_18px_5px_rgba(192,132,252,.65)]" />
          </div>

          {/* Dashed circular stroke */}
          <div className="xo-circle-glow absolute inset-[18%] rounded-full border border-dashed border-purple-400/25" />

          {/* Central glow */}
          <div className="absolute left-1/2 top-1/2 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600/10 blur-[100px] sm:h-[450px] sm:w-[450px]" />
        </div>
      </div>

      {/* HERO CONTENT */}
      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center text-center">
        {/* Top label */}
        <div className="xo-reveal mb-9 inline-flex items-center gap-2 rounded-full border border-violet-300/25 bg-[#100d1b]/80 px-4 py-2.5 shadow-[0_0_35px_rgba(139,92,246,.12)] backdrop-blur-xl">
          <Sparkles size={15} className="text-violet-300" />

          <span className="text-[10px] font-semibold uppercase tracking-[0.19em] text-violet-200 sm:text-xs">
            The XO Template Registry
          </span>

          <span className="h-1 w-1 rounded-full bg-orange-400" />

          <span className="text-[10px] text-white/60 sm:text-xs">
            Open ecosystem
          </span>
        </div>

        {/* Main heading */}
        <h1 className="xo-reveal xo-delay-1 max-w-5xl text-[clamp(3.2rem,9vw,7.8rem)] font-semibold leading-[0.98] tracking-[-0.075em]">
          The home for
          <br />
          <span className="relative inline-block bg-gradient-to-r from-orange-300 via-orange-500 to-amber-300 bg-clip-text text-transparent">
            <span className="sr-only">
              XO templates, Wallet templates, Open templates.
            </span>

            <span aria-hidden="true" className="inline-block">
              {text}
            </span>

            <span className="xo-cursor" aria-hidden="true">
              |
            </span>

            <span className="absolute -bottom-2 left-1/2 h-[3px] w-[55%] -translate-x-1/2 rounded-full bg-gradient-to-r from-transparent via-orange-400 to-transparent shadow-[0_0_15px_rgba(251,146,60,.8)]" />
          </span>
        </h1>

        {/* Product description */}
        <p className="xo-reveal xo-delay-2 mt-8 max-w-2xl text-base leading-8 text-white/65 sm:text-lg sm:leading-9">
          Discover, publish and inspect XO wallet templates in one open
          registry. Explore automated checks, community reviews and wallet
          policy decisions before choosing a template.
        </p>

        {/* CTA BUTTONS */}
        <div className="xo-reveal xo-delay-3 mt-10 flex w-full flex-col justify-center gap-4 sm:w-auto sm:flex-row">
          {/* Primary CTA */}
          <Link
            to="/browse"
            className="group inline-flex items-center justify-center gap-3 rounded-xl bg-orange-500 px-8 py-4 text-sm font-semibold text-white shadow-[0_12px_45px_rgba(249,115,22,.25)] transition-all duration-300 hover:-translate-y-1 hover:bg-orange-400 hover:shadow-[0_15px_50px_rgba(249,115,22,.45)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
          >
            Explore templates
            <ArrowRight
              size={17}
              className="transition-transform duration-300 group-hover:translate-x-1"
            />
          </Link>

          {/* Secondary CTA */}
          <a
            href="#how-it-works"
            className="group inline-flex items-center justify-center gap-3 rounded-xl border border-white/20 bg-[#100d1b]/70 px-8 py-4 text-sm font-semibold text-white/90 backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/60 hover:bg-violet-500/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
          >
            How it works
            <ArrowUpRight
              size={17}
              className="text-violet-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:-translate-y-1"
            />
          </a>
        </div>

        {/* PRODUCT FEATURES */}
        <div className="xo-reveal xo-delay-4 mt-16 flex flex-wrap items-center justify-center gap-x-7 gap-y-5 border-t border-white/15 px-3 pt-8 sm:gap-x-12">
          <div className="flex items-center gap-2.5 text-xs text-white/65">
            <Fingerprint size={16} className="text-violet-300" />
            Content-addressed IDs
          </div>

          <div className="flex items-center gap-2.5 text-xs text-white/65">
            <ShieldCheck size={16} className="text-violet-300" />
            Automated checks
          </div>

          <div className="flex items-center gap-2.5 text-xs text-white/65">
            <Layers3 size={16} className="text-violet-300" />
            Open registry
          </div>
        </div>
      </div>

      {/* SCROLL INDICATOR */}
      <a
        href="#how-it-works"
        aria-label="Scroll to How It Works"
        className="group absolute bottom-7 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/50 transition-colors hover:text-orange-300"
      >
        <span className="mb-2 text-[9px] font-medium uppercase tracking-[0.25em]">
          Discover more
        </span>

        <ArrowDown size={16} className="xo-scroll" />
      </a>
    </section>
  );
}

export default Hero;
