
import { useEffect, useState } from "react";
import { Routes, Route } from "react-router-dom";

import LandingPage from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Explore from "./pages/Explore";
import Publish from "./pages/Publish";
import Policy from "./pages/Policy";

import xogridlogo from "./assets/images/xogridlogo.png";

interface LoadingScreenProps {
  exiting: boolean;
}

function LoadingScreen({ exiting }: LoadingScreenProps) {
  return (
    <div
      className={`xogrid-loader ${exiting ? "xogrid-loader-exit" : ""}`}
      role="status"
      aria-label="Loading XOGrid"
    >
      <div className="loader-glow loader-glow-one" />
      <div className="loader-glow loader-glow-two" />

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

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => {
      setIsExiting(true);
    }, 1600);

    const removeTimer = setTimeout(() => {
      setIsLoading(false);
    }, 2050);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(removeTimer);
    };
  }, []);

  return (
    <>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/explore" element={<Explore />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/policy" element={<Policy />} />
      </Routes>

      {isLoading && <LoadingScreen exiting={isExiting} />}
    </>
  );
}

export default App;
