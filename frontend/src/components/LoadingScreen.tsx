
import xogridlogo from "../assets/images/xogridlogo.png";

function LoadingScreen({ exiting = false }) {
  return (
    <div
      className={`xogrid-loader ${exiting ? "xogrid-loader-exit" : ""}`}
      role="status"
      aria-label="Loading XOGrid"
    >
      {/* Ambient background glows */}
      <div className="loader-glow loader-glow-one" />
      <div className="loader-glow loader-glow-two" />

      <div className="loader-content">
        {/* Animated logo */}
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

        {/* Animated grid */}
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

        {/* Progress indicator */}
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
