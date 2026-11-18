
import xogridlogo from "../assets/images/xogridlogo.png";
import { SiBitcoincash } from "react-icons/si";

interface LoadingScreenProps {
  exiting?: boolean;
}

const bitcoinCashIcons = [
  { top: "10%", left: "8%", size: 38 },
  { top: "18%", right: "10%", size: 30 },
  { top: "42%", left: "5%", size: 28 },
  { top: "65%", right: "8%", size: 42 },
  { bottom: "12%", left: "18%", size: 34 },
  { top: "8%", left: "48%", size: 25 },
  { bottom: "22%", right: "22%", size: 30 },
  { top: "52%", right: "5%", size: 24 },
  { top: "30%", left: "23%", size: 22 },
  { bottom: "8%", right: "43%", size: 36 },
  { top: "75%", left: "7%", size: 27 },
  { top: "35%", right: "25%", size: 23 },
];

function LoadingScreen({ exiting = false }: LoadingScreenProps) {
  return (
    <div
      className={`xogrid-loader ${exiting ? "xogrid-loader-exit" : ""}`}
      role="status"
      aria-label="Loading XOGrid"
    >
      <style>{`
        .bch-icons-layer {
          position: absolute !important;
          inset: 0 !important;
          z-index: 10 !important;
          overflow: hidden;
          pointer-events: none;
        }

        .bch-glow-icon {
          position: absolute;
          display: block;
          color: #00D6A0 !important;
          opacity: .8;
          filter:
            drop-shadow(0 0 8px rgba(0, 214, 160, .95))
            drop-shadow(0 0 18px rgba(0, 214, 160, .75))
            drop-shadow(0 0 35px rgba(0, 214, 160, .45));
          animation:
            bchIconFloat 4s ease-in-out infinite,
            bchIconPulse 2s ease-in-out infinite alternate;
        }

        .bch-glow-icon svg {
          display: block;
          width: 1em;
          height: 1em;
          fill: currentColor;
        }

        @keyframes bchIconFloat {
          0%, 100% {
            transform: translateY(0) rotate(-8deg);
          }
          50% {
            transform: translateY(-22px) rotate(8deg);
          }
        }

        @keyframes bchIconPulse {
          from {
            opacity: .35;
          }
          to {
            opacity: 1;
          }
        }

        .loader-content {
          position: relative;
          z-index: 20 !important;
        }

        @media (prefers-reduced-motion: reduce) {
          .bch-glow-icon {
            animation: none;
          }
        }
      `}</style>

      {/* Ambient background glows */}
      <div className="loader-glow loader-glow-one" />
      <div className="loader-glow loader-glow-two" />

      {/* Glowing green Bitcoin Cash icons */}
      <div className="bch-icons-layer" aria-hidden="true">
        {bitcoinCashIcons.map((item, index) => (
          <span
            key={index}
            className="bch-glow-icon"
            style={{
              top: item.top,
              left: item.left,
              right: item.right,
              bottom: item.bottom,
              fontSize: `${item.size}px`,
              animationDelay: `${index * 0.25}s`,
            }}
          >
            <SiBitcoincash />
          </span>
        ))}
      </div>

      {/* Main loading content */}
      <div className="loader-content">
        <div className="loader-logo-wrap">
          <div className="loader-orbit loader-orbit-one" />
          <div className="loader-orbit loader-orbit-two" />

          <img
            src={xogridlogo}
            alt="XOGrid"
            className="loader-logo"
          />
        </div>

        <p className="loader-tagline">
          THE TEMPLATE REGISTRY
        </p>

        <div className="loader-grid">
          {Array.from({ length: 9 }).map((_, index) => (
            <span
              key={index}
              style={{ animationDelay: `${index * 0.09}s` }}
            />
          ))}
        </div>

        <p className="loader-message">
          Preparing your experience
          <span className="loader-dots">...</span>
        </p>

        <div className="loader-progress">
          <span />
        </div>

        <span className="loader-version">
          EXPLORE. PUBLISH. BUILD TRUST.
        </span>
      </div>
    </div>
  );
}

export default LoadingScreen;
