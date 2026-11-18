
import { useEffect, useState, type MouseEvent } from "react";
import {
  Menu,
  X,
  ArrowUpRight,
  Wallet,
} from "lucide-react";

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";

import xogridlogo from "../assets/images/xogridlogo.png";
import { shortenAddress, useWallet } from "../hub/WalletContext";

interface NavLink {
  name: string;
  href: string;
  section?: string;
}

interface NavigationState {
  scrollToSection?: string;
}

function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const { connected, walletName, address, openModal } = useWallet();

  const location = useLocation();
  const navigate = useNavigate();

  const navLinks: NavLink[] = [
    {
      name: "How It Works",
      href: "/#how-it-works",
      section: "how-it-works",
    },
    {
      name: "Featured Templates",
      href: "/#featured-templates",
      section: "featured-templates",
    },
    {
      name: "Demo",
      href: "/demo",
    },
    {
      name: "Publish",
      href: "/publish",
    },
    {
      name: "Policy",
      href: "/policy",
    },
  ];

  // Navbar scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 30);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Automatically detect homepage section
  useEffect(() => {
    if (location.pathname !== "/") return;

    const sectionIds = ["home", "how-it-works", "featured-templates"];

    const updateActiveSection = () => {
      const marker = window.scrollY + window.innerHeight * 0.35;

      let currentSection = "home";

      sectionIds.forEach((id) => {
        const section = document.getElementById(id);

        if (!section) return;

        const sectionTop =
          section.getBoundingClientRect().top + window.scrollY;

        if (marker >= sectionTop) {
          currentSection = id;
        }
      });

      setActiveSection(currentSection);
    };

    updateActiveSection();

    window.addEventListener("scroll", updateActiveSection, {
      passive: true,
    });

    window.addEventListener("resize", updateActiveSection);

    return () => {
      window.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [location.pathname]);

  // Track active routes outside homepage
  useEffect(() => {
    if (location.pathname === "/") return;

    setActiveSection(location.pathname);
  }, [location.pathname]);

  // Escape key closes mobile navigation
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
    };
  }, []);

  // Navigate home
  const handleHomeClick = () => {
    setMenuOpen(false);

    if (location.pathname === "/") {
      document.getElementById("home")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setActiveSection("home");
    } else {
      navigate("/", {
        state: {
          scrollToSection: "home",
        } satisfies NavigationState,
      });
    }
  };

  // Navigate to homepage sections
  const handleSectionClick = (
    event: MouseEvent<HTMLAnchorElement>,
    link: NavLink,
  ) => {
    if (!link.section) {
      setMenuOpen(false);
      return;
    }

    event.preventDefault();
    setMenuOpen(false);

    if (location.pathname === "/") {
      document.getElementById(link.section)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setActiveSection(link.section);
    } else {
      navigate("/", {
        state: {
          scrollToSection: link.section,
        } satisfies NavigationState,
      });
    }
  };

  // Scroll after returning to homepage
  useEffect(() => {
    const navigationState =
      location.state as NavigationState | null;

    const target = navigationState?.scrollToSection;

    if (location.pathname !== "/" || !target) return;

    const frame = requestAnimationFrame(() => {
      document.getElementById(target)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });

      setActiveSection(target);

      navigate("/", {
        replace: true,
        state: null,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [location.pathname, location.state, navigate]);

  // Check active navigation link
  const isLinkActive = (link: NavLink): boolean => {
    if (link.section) {
      return (
        location.pathname === "/" &&
        activeSection === link.section
      );
    }

    return location.pathname === link.href;
  };

  // Open the shared wallet modal
  const openWalletModal = () => {
    setMenuOpen(false);
    openModal();
  };

  // Once connected the button shows a shortened receive address (like bchtest:qp9c…tw6y). The wallet name is only a
  // fallback for the moment before the wallet has shared its key.
  const walletLabel = address
    ? shortenAddress(address)
    : walletName.length > 18
      ? `${walletName.slice(0, 17)}…`
      : walletName;
  const walletTitle = address ? `${walletName}: ${address}` : walletName;

  return (
    <>
      <header
        style={{ top: "var(--banner-offset, 0px)" }}
        className="fixed inset-x-0 top-0 z-50 px-4 pt-4 sm:px-6 lg:px-10"
      >
        <nav
          className={`mx-auto flex h-[76px] max-w-[1440px] items-center justify-between rounded-2xl px-4 transition-all duration-500 sm:px-7 ${
            scrolled
              ? "border border-white/[0.09] bg-[#090A13]/75 shadow-[0_12px_50px_rgba(0,0,0,0.3)] backdrop-blur-2xl"
              : "border border-transparent bg-transparent shadow-none backdrop-blur-none"
          }`}
        >
          {/* Logo */}
          <button
            type="button"
            onClick={handleHomeClick}
            aria-label="XOGrid - Back to home"
            className="group flex shrink-0 items-center rounded-lg outline-none transition-transform duration-300 hover:scale-[1.03] focus-visible:ring-2 focus-visible:ring-orange-400"
          >
            <img
              src={xogridlogo}
              alt="XOGrid"
              className="h-12 w-auto object-contain sm:h-14"
            />
          </button>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 lg:flex">
            {/* Home */}
            <button
              type="button"
              onClick={handleHomeClick}
              className={`group relative rounded-xl px-4 py-3 text-[13px] font-medium tracking-wide transition-all duration-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                location.pathname === "/" && activeSection === "home"
                  ? "text-orange-400"
                  : "text-white/75 hover:text-white"
              }`}
            >
              Home

              <span
                className={`absolute bottom-1.5 left-4 right-4 h-[2px] origin-center rounded-full bg-orange-500 transition-transform duration-300 ${
                  location.pathname === "/" && activeSection === "home"
                    ? "scale-x-100"
                    : "scale-x-0 group-hover:scale-x-100"
                }`}
              />
            </button>

            {/* Navigation Links */}
            {navLinks.map((link) => {
              const active = isLinkActive(link);

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(event) => handleSectionClick(event, link)}
                  aria-current={active ? "page" : undefined}
                  className={`group relative rounded-xl px-4 py-3 text-[13px] font-medium tracking-wide transition-all duration-300 hover:bg-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
                    active
                      ? "text-orange-400"
                      : "text-white/75 hover:text-white"
                  }`}
                >
                  {link.name}

                  <span
                    className={`absolute bottom-1.5 left-4 right-4 h-[2px] origin-center rounded-full bg-orange-500 transition-transform duration-300 ${
                      active
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100"
                    }`}
                  />
                </Link>
              );
            })}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex">
            <button
              type="button"
              onClick={openWalletModal}
              title={connected ? walletTitle : "Connect a wallet"}
              className="group relative flex items-center gap-3 overflow-hidden rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/15 transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-orange-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-300"
            >
              {connected ? (
                <>
                  <span
                    aria-hidden="true"
                    className="relative z-10 h-2 w-2 rounded-full bg-emerald-300"
                  />
                  <span className="relative z-10 font-mono tracking-tight">{walletLabel}</span>
                </>
              ) : (
                <>
                  <Wallet size={17} className="relative z-10" />
                  <span className="relative z-10">Connect Wallet</span>
                </>
              )}
            </button>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            type="button"
            onClick={() => setMenuOpen((previous) => !previous)}
            aria-label={
              menuOpen ? "Close navigation menu" : "Open navigation menu"
            }
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white transition-all duration-300 hover:border-orange-400/50 hover:bg-orange-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 lg:hidden"
          >
            {menuOpen ? <X size={21} /> : <Menu size={21} />}
          </button>
        </nav>

        {/* Mobile Navigation */}
        <div
          id="mobile-navigation"
          aria-hidden={!menuOpen}
          className={`mx-auto mt-3 max-w-[1440px] overflow-hidden rounded-2xl border border-white/[0.09] bg-[#0B0C16]/90 shadow-2xl shadow-black/40 backdrop-blur-2xl transition-all duration-300 lg:hidden ${
            menuOpen
              ? "max-h-135 translate-y-0 p-4 opacity-100"
              : "pointer-events-none max-h-0 -translate-y-2 border-transparent p-0 opacity-0"
          }`}
        >
          <div className="flex flex-col gap-2">
            {/* Mobile Home */}
            <button
              type="button"
              onClick={handleHomeClick}
              tabIndex={menuOpen ? 0 : -1}
              className={`group flex w-full items-center justify-between rounded-xl border px-4 py-3.5 text-left text-sm font-medium transition-all duration-300 ${
                location.pathname === "/" && activeSection === "home"
                  ? "border-orange-400/20 bg-orange-500/10 text-orange-400"
                  : "border-transparent text-white/70 hover:border-orange-400/20 hover:bg-orange-500/10 hover:text-white"
              }`}
            >
              Home

              <ArrowUpRight
                size={15}
                className="text-white/30 transition-all duration-300 group-hover:text-orange-400"
              />
            </button>

            {/* Mobile Navigation Links */}
            {navLinks.map((link) => {
              const active = isLinkActive(link);

              return (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={(event) => handleSectionClick(event, link)}
                  tabIndex={menuOpen ? 0 : -1}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center justify-between rounded-xl border px-4 py-3.5 text-sm font-medium transition-all duration-300 ${
                    active
                      ? "border-orange-400/20 bg-orange-500/10 text-orange-400"
                      : "border-transparent text-white/70 hover:border-orange-400/20 hover:bg-orange-500/10 hover:text-white"
                  }`}
                >
                  {link.name}

                  <ArrowUpRight
                    size={15}
                    className="text-white/30 transition-all duration-300 group-hover:text-orange-400"
                  />
                </Link>
              );
            })}

            <div className="my-2 border-t border-white/[0.08]" />

            {/* Mobile CTA */}
            <button
              type="button"
              onClick={openWalletModal}
              title={connected ? walletTitle : "Connect a wallet"}
              className="flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-orange-500/15 transition-all duration-300 hover:bg-orange-400"
            >
              {connected ? (
                <>
                  <span
                    aria-hidden="true"
                    className="h-2 w-2 rounded-full bg-emerald-300"
                  />
                  <span className="font-mono tracking-tight">{walletLabel}</span>
                </>
              ) : (
                <>
                  <Wallet size={17} />
                  Connect Wallet
                </>
              )}
            </button>
          </div>
        </div>
      </header>

    </>
  );
}

export default Navbar;
