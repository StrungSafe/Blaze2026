
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ShieldCheck,
  ArrowUp,
  ArrowUpRight,
  Mail,
} from "lucide-react";

import {
  SiX,
  SiDiscord,
  SiTelegram,
  SiGithub,
} from "react-icons/si";

import xogridlogo from "../assets/images/xogridlogo.png";

interface FooterLink {
  name: string;
  href: string;
}

function Footer() {
  const currentYear = new Date().getFullYear();
  const location = useLocation();

  // Replace these with your official XOGrid accounts.
  const CONTACT_EMAIL = "xogrid@.com";

  const socialLinks = [
    { name: "X", href: "https://x.com/YOUR_X_USERNAME", icon: SiX },
    { name: "Discord", href: "https://discord.gg/YOUR_INVITE", icon: SiDiscord },
    { name: "Telegram", href: "https://t.me/YOUR_USERNAME", icon: SiTelegram },
    { name: "GitHub", href: "https://github.com/YOUR_GITHUB", icon: SiGithub },
  ];

  const footerLinks: Record<string, FooterLink[]> = {
    Platform: [
      { name: "Home", href: "/" },
      { name: "How It Works", href: "/#how-it-works" },
      { name: "Publish Template", href: "/publish" },
    ],
    Resources: [
      { name: "Policy", href: "/policy" },
      { name: "Demo", href: "/demo" },
      { name: "Documentation", href: "/docs" },
    ],
  };

  useEffect(() => {
    if (!location.hash) return;

    const sectionId = decodeURIComponent(location.hash.slice(1));

    const timeout = window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [location.pathname, location.hash]);

  const isActiveLink = (href: string): boolean => {
    const [pathname, hash] = href.split("#");

    if (hash) {
      return location.pathname === pathname && location.hash === `#${hash}`;
    }

    if (href === "/") {
      return location.pathname === "/" && !location.hash;
    }

    return location.pathname === href;
  };

  const footerLinkClass = (href: string): string =>
    `xogrid-footer-link group inline-flex items-center gap-2 text-sm ${
      isActiveLink(href) ? "is-active" : ""
    }`;

  const renderLinks = (links: FooterLink[]): ReactNode =>
    links.map((link) => {
      const active = isActiveLink(link.href);

      return (
        <li key={link.name}>
          <Link
            to={link.href}
            aria-current={active ? "page" : undefined}
            className={footerLinkClass(link.href)}
          >
            <span>{link.name}</span>
            <ArrowUpRight size={13} className="footer-link-arrow" />
          </Link>
        </li>
      );
    });

  return (
    <footer className="relative overflow-hidden border-t border-white/[0.08] bg-[#05070b]">
      <style>{`
        .xogrid-footer-link {
          color: rgba(255,255,255,.45) !important;
          text-decoration: none !important;
          transition: color 250ms ease !important;
        }

        .xogrid-footer-link:hover,
        .xogrid-footer-link:focus-visible,
        .xogrid-footer-link.is-active {
          color: #F97316 !important;
          text-decoration: none !important;
        }

        .xogrid-footer-link.is-active {
          font-weight: 600;
        }

        .footer-link-arrow {
          opacity: 0;
          transform: translate(-4px,0);
          transition: all 250ms ease;
          flex-shrink: 0;
        }

        .xogrid-footer-link:hover .footer-link-arrow,
        .xogrid-footer-link:focus-visible .footer-link-arrow,
        .xogrid-footer-link.is-active .footer-link-arrow {
          opacity: 1;
          transform: translate(0,0);
        }

        .xogrid-footer-policy {
          color: rgba(255,255,255,.4) !important;
          text-decoration: none !important;
          transition: color 250ms ease !important;
        }

        .xogrid-footer-policy:hover,
        .xogrid-footer-policy:focus-visible,
        .xogrid-footer-policy.is-active {
          color: #F97316 !important;
          text-decoration: none !important;
        }

        .xogrid-footer-social {
          display: flex;
          width: 39px;
          height: 39px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgba(255,255,255,.1);
          border-radius: 11px;
          background: rgba(255,255,255,.03);
          color: rgba(255,255,255,.55);
          transition: all 250ms ease;
        }

        .xogrid-footer-social:hover {
          color: #F97316;
          border-color: rgba(249,115,22,.4);
          background: rgba(249,115,22,.08);
          transform: translateY(-3px);
        }

        .xogrid-footer-email {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          color: rgba(255,255,255,.5);
          font-size: 13px;
          transition: color 250ms ease;
        }

        .xogrid-footer-email:hover {
          color: #F97316;
        }

        @keyframes waveFlow {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @keyframes waveFlowReverse {
          from { transform: translateX(-50%); }
          to { transform: translateX(0); }
        }

        @keyframes waveHighlight {
          0%,100% {
            transform: translateX(0) translateY(0);
            opacity: .5;
          }
          50% {
            transform: translateX(-2%) translateY(-7px);
            opacity: 1;
          }
        }

        .animate-wave {
          animation: waveFlow 20s linear infinite;
        }

        .animate-wave-reverse {
          animation: waveFlowReverse 27s linear infinite;
        }

        .animate-wave-highlight {
          animation: waveHighlight 9s ease-in-out infinite;
        }

        @media (max-width: 640px) {
          .animate-wave { animation-duration: 25s; }
          .animate-wave-reverse { animation-duration: 32s; }
        }

        @media (prefers-reduced-motion: reduce) {
          .animate-wave,
          .animate-wave-reverse,
          .animate-wave-highlight {
            animation: none;
          }
        }
      `}</style>

      {/* Ambient lighting */}
      <div className="pointer-events-none absolute -top-32 left-1/4 h-72 w-72 rounded-full bg-purple-600/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-orange-500/[0.05] blur-[110px]" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 pb-8 pt-16 sm:px-8 lg:px-12">
        {/* Main footer */}
        <div className="grid grid-cols-1 gap-12 border-b border-white/[0.08] pb-14 md:grid-cols-2 lg:grid-cols-5 lg:gap-10">
          {/* Brand */}
          <div className="lg:col-span-2">
            <Link to="/" className="inline-flex items-center gap-3">
              <img
                src={xogridlogo}
                alt="XOGrid logo"
                className="h-10 w-auto object-contain"
              />
            </Link>

            <p className="mt-6 max-w-md text-sm leading-7 text-white/45">
              Discover, publish, and evaluate XO wallet templates.
              XOGrid gives developers a transparent registry for
              exploring template identities, automated checks, and
              community accountability.
            </p>

            <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/55">
                Built for the Bitcoin Cash ecosystem
              </span>
            </div>
          </div>

          {/* Platform */}
          <div>
            <h3 className="text-sm font-semibold text-white">Platform</h3>
            <ul className="mt-6 space-y-5">
              {renderLinks(footerLinks.Platform)}
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="text-sm font-semibold text-white">Resources</h3>
            <ul className="mt-6 space-y-5">
              {renderLinks(footerLinks.Resources)}
            </ul>
          </div>

          {/* Follow us and email */}
          <div>
            <h3 className="text-sm font-semibold text-white">Follow Us</h3>

            <div className="mt-6 flex flex-wrap gap-3">
              {socialLinks.map(({ name, href, icon: Icon }) => (
                <a
                  key={name}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Follow XOGrid on ${name}`}
                  title={name}
                  className="xogrid-footer-social"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>

            <h3 className="mt-8 text-sm font-semibold text-white">Email Us</h3>

            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="xogrid-footer-email mt-5"
            >
              <Mail size={16} />
              <span>{CONTACT_EMAIL}</span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </div>

        {/* Bottom section */}
        <div className="flex flex-col gap-6 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-white/35">
            © {currentYear} XOGrid. All rights reserved.
          </p>

          <div className="flex flex-wrap items-center gap-5">
            <Link
              to="/policy"
              className={`xogrid-footer-policy text-xs ${
                location.pathname === "/policy" ? "is-active" : ""
              }`}
            >
              Trust &amp; Policy
            </Link>

            <button
              type="button"
              onClick={() =>
                window.scrollTo({ top: 0, behavior: "smooth" })
              }
              aria-label="Back to top"
              className="group flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-white/50 transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:bg-orange-500/10 hover:text-orange-500"
            >
              <ArrowUp
                size={16}
                className="transition-transform duration-300 group-hover:-translate-y-1"
              />
            </button>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-8 flex items-start gap-3 border-t border-white/[0.06] pt-6">
          <ShieldCheck
            size={16}
            className="mt-0.5 shrink-0 text-orange-500/70"
          />

          <p className="max-w-3xl text-[11px] leading-6 text-white/30">
            XOGrid is a template registry, not a wallet or security
            certification service. Automated checks and community
            reviews provide information to help users make their own
            decisions. They do not guarantee that a template is safe.
          </p>
        </div>
      </div>

      {/* Animated waves */}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-40 overflow-hidden sm:h-48 lg:h-60">
        {/* Purple wave */}
        <svg
          className="absolute bottom-0 left-0 h-full w-[200%] animate-wave"
          viewBox="0 0 1440 240"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 105 C120 35 240 35 360 105 C480 175 600 175 720 105 C840 35 960 35 1080 105 C1200 175 1320 175 1440 105 V240 H0 Z"
            fill="#8B5CF6"
            fillOpacity="0.10"
          />
          <path
            d="M0 135 C150 65 270 65 420 135 C570 205 690 205 840 135 C990 65 1110 65 1260 135 C1350 175 1400 175 1440 155 V240 H0 Z"
            fill="#A78BFA"
            fillOpacity="0.07"
          />
        </svg>

        {/* Orange wave */}
        <svg
          className="absolute bottom-0 left-0 h-full w-[200%] animate-wave-reverse"
          viewBox="0 0 1440 240"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 150 C120 210 240 210 360 150 C480 90 600 90 720 150 C840 210 960 210 1080 150 C1200 90 1320 90 1440 150 V240 H0 Z"
            fill="#F97316"
            fillOpacity="0.055"
          />
          <path
            d="M0 175 C150 115 270 115 420 175 C570 235 690 235 840 175 C990 115 1110 115 1260 175 C1350 210 1400 210 1440 190 V240 H0 Z"
            fill="#8B5CF6"
            fillOpacity="0.065"
          />
        </svg>

        {/* Highlight wave */}
        <svg
          className="absolute bottom-0 left-0 h-full w-[200%] animate-wave-highlight"
          viewBox="0 0 1440 240"
          preserveAspectRatio="none"
          fill="none"
        >
          <path
            d="M0 125 C180 55 300 55 480 125 C660 195 780 195 960 125 C1140 55 1260 55 1440 125"
            stroke="#A78BFA"
            strokeOpacity="0.18"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </footer>
  );
}

export default Footer;
