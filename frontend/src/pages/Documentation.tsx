
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Compass,
  FileText,
  HelpCircle,
  Layers3,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

const documentationSections = [
  { id: "overview", label: "Overview", group: "GETTING STARTED", icon: BookOpen },
  { id: "getting-started", label: "Getting Started", group: "GETTING STARTED", icon: Zap },
  { id: "wallet", label: "Wallet Connection", group: "GETTING STARTED", icon: Wallet },
  { id: "explore", label: "Exploring Templates", group: "PLATFORM", icon: Compass },
  { id: "publishing", label: "Publishing Templates", group: "PLATFORM", icon: Layers3 },
  { id: "verification", label: "Verification & Trust", group: "PLATFORM", icon: ShieldCheck },
  { id: "developers", label: "Developer Guide", group: "DEVELOPERS", icon: Code2 },
  { id: "faq", label: "FAQs", group: "SUPPORT", icon: HelpCircle },
];

const faqs = [
  {
    question: "What is XOGrid?",
    answer:
      "XOGrid is a template registry for the Bitcoin Cash ecosystem. It provides a place to discover, publish, and review templates while making useful information about them easier to find.",
  },
  {
    question: "Do I need a wallet to explore templates?",
    answer:
      "You can browse the available platform pages and explore templates. Wallet connection is relevant when you need to use features that require a connected wallet, such as publishing.",
  },
  {
    question: "How do I publish a template?",
    answer:
      "Open the Publish page, connect your supported wallet when prompted, and follow the submission form. Provide accurate template information and review your submission before submitting it.",
  },
  {
    question: "What does template verification mean?",
    answer:
      "Verification information helps users understand the checks and review status associated with a template. Always review the available details rather than assuming every template has passed every check.",
  },
  {
    question: "Can I report a problem with a template?",
    answer:
      "Use the community reporting functionality when it is available on the relevant template or platform page. Include clear details so the issue can be reviewed.",
  },
  {
    question: "Where can developers find API documentation?",
    answer:
      "The developer section explains the integration documentation currently available here. Exact API endpoints, request formats, authentication requirements, and response schemas should be confirmed with the XOGrid backend documentation.",
  },
  {
    question: "Why is my wallet not connecting?",
    answer:
      "Check that your wallet provider is available, your browser allows the connection, and your wallet is unlocked. If the issue continues, disconnect and try again or contact the XOGrid team.",
  },
];

const sectionContent: Record<string, { eyebrow: string; title: string; description: string }> = {
  overview: {
    eyebrow: "WELCOME TO XOGRID",
    title: "The template registry for the BCH ecosystem.",
    description:
      "Discover useful templates, publish your work, and build trust through clearer information and community participation.",
  },
  "getting-started": {
    eyebrow: "GETTING STARTED",
    title: "Start exploring XOGrid.",
    description:
      "Get familiar with the platform and understand the basic steps for discovering and contributing templates.",
  },
  wallet: {
    eyebrow: "GETTING STARTED",
    title: "Connect your wallet.",
    description:
      "Your wallet helps you access platform features that require a connected Bitcoin Cash account.",
  },
  explore: {
    eyebrow: "PLATFORM GUIDE",
    title: "Discover templates.",
    description:
      "Explore the registry, review template information, and find resources relevant to your work.",
  },
  publishing: {
    eyebrow: "PLATFORM GUIDE",
    title: "Share your template with the ecosystem.",
    description:
      "Publish useful resources with clear information so other users can discover and evaluate your work.",
  },
  verification: {
    eyebrow: "PLATFORM GUIDE",
    title: "Understand verification and trust.",
    description:
      "Learn how verification information, review status, and community feedback help users assess templates.",
  },
  developers: {
    eyebrow: "DEVELOPER RESOURCES",
    title: "Build with XOGrid.",
    description:
      "Understand the integration resources available and where to find the technical details needed for development.",
  },
  faq: {
    eyebrow: "SUPPORT CENTER",
    title: "Frequently asked questions.",
    description:
      "Find answers to common questions about using the XOGrid platform.",
  },
};

function Documentation() {
  const [activeSection, setActiveSection] = useState("overview");
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const filteredSections = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return documentationSections;

    return documentationSections.filter((section) => {
      const content = sectionContent[section.id];

      return (
        section.label.toLowerCase().includes(query) ||
        section.group.toLowerCase().includes(query) ||
        content.title.toLowerCase().includes(query) ||
        content.description.toLowerCase().includes(query)
      );
    });
  }, [searchQuery]);

  const groups = Array.from(
    new Set(documentationSections.map((section) => section.group))
  );

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 500);

      const sections = documentationSections
        .map((item) => document.getElementById(item.id))
        .filter(Boolean) as HTMLElement[];

      let current = "overview";

      sections.forEach((section) => {
        if (section.getBoundingClientRect().top <= 180) {
          current = section.id;
        }
      });

      setActiveSection(current);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navigateToSection = (id: string) => {
    setActiveSection(id);
    setMobileMenuOpen(false);

    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  };

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  return (
    <div className="xg-docs">
      <style>{`
        .xg-docs {
          --xg-bg: #05070B;
          --xg-panel: #0B0E13;
          --xg-card: #0D1117;
          --xg-border: rgba(255,255,255,0.085);
          --xg-text: #F4F4F5;
          --xg-muted: #9299A5;
          --xg-orange: #F97316;
          --xg-orange-light: #FDBA74;
          min-height: 100vh;
          background: var(--xg-bg);
          color: var(--xg-text);
          font-family: inherit;
          overflow: clip;
        }

        .xg-docs * { box-sizing: border-box; }

        .xg-docs button,
        .xg-docs input { font: inherit; }

        .xg-docs button { cursor: pointer; }

        .xg-docs a { text-decoration: none; color: inherit; }

        .xg-docs-header {
          height: 76px;
          padding: 0 6%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--xg-border);
          background: rgba(5,7,11,0.94);
          backdrop-filter: blur(18px);
          position: sticky;
          top: 0;
          z-index: 60;
        }

        .xg-docs-brand {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 18px;
          font-weight: 800;
          letter-spacing: -0.6px;
        }

        .xg-docs-brand-mark {
          width: 37px;
          height: 37px;
          border-radius: 11px;
          display: grid;
          place-items: center;
          color: white;
          background: linear-gradient(135deg,#FB923C,#EA580C);
          box-shadow: 0 0 25px rgba(249,115,22,0.22);
        }

        .xg-docs-brand small {
          display: block;
          color: var(--xg-muted);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 2px;
          margin-top: 2px;
        }

        .xg-docs-header-right {
          display: flex;
          align-items: center;
          gap: 22px;
        }

        .xg-docs-back {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #AEB4BE;
          font-size: 13px;
          transition: color .25s ease;
        }

        .xg-docs-back:hover { color: var(--xg-orange); }

        .xg-docs-header-cta {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 11px 16px;
          border-radius: 9px;
          color: white;
          background: #F97316;
          font-size: 12px;
          font-weight: 800;
          transition: transform .25s ease, background .25s ease;
        }

        .xg-docs-header-cta:hover {
          background: #EA580C;
          transform: translateY(-2px);
        }

        .xg-docs-menu-button {
          display: none;
          width: 40px;
          height: 40px;
          border: 1px solid var(--xg-border);
          background: var(--xg-panel);
          color: white;
          border-radius: 9px;
          align-items: center;
          justify-content: center;
        }

        /* Main layout */
        .xg-docs-layout {
          max-width: 1500px;
          margin: auto;
          display: block;
          min-height: calc(100vh - 76px);
        }

        /* Fixed desktop sidebar */
        .xg-docs-sidebar {
          position: fixed;
          top: calc(76px + var(--banner-offset, 0px));
          bottom: 0;
          left: max(0px, calc((100vw - 1500px) / 2));
          width: 265px;
          z-index: 40;
          border-right: 1px solid var(--xg-border);
          padding: 35px 20px 60px 20px;
          overflow-y: auto;
          overflow-x: hidden;
          background: #05070B;
          scrollbar-width: thin;
          scrollbar-color: #292D35 transparent;
        }

        .xg-docs-sidebar::-webkit-scrollbar { width: 4px; }
        .xg-docs-sidebar::-webkit-scrollbar-thumb {
          background: #292D35;
          border-radius: 10px;
        }

        .xg-docs-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }

        .xg-docs-search {
          display: flex;
          align-items: center;
          gap: 10px;
          height: 43px;
          padding: 0 12px;
          border: 1px solid var(--xg-border);
          border-radius: 9px;
          background: #0A0D12;
          color: var(--xg-muted);
          margin-bottom: 34px;
          transition: border .25s ease, box-shadow .25s ease;
        }

        .xg-docs-search:focus-within {
          border-color: rgba(249,115,22,.7);
          box-shadow: 0 0 0 3px rgba(249,115,22,.08);
        }

        .xg-docs-search input {
          width: 100%;
          outline: none;
          border: 0;
          background: transparent;
          color: white;
          font-size: 12px;
        }

        .xg-docs-search input::placeholder { color: #69717D; }

        .xg-docs-nav-group { margin-bottom: 29px; }

        .xg-docs-nav-heading {
          color: #606875;
          font-size: 9px;
          font-weight: 800;
          letter-spacing: 1.8px;
          margin: 0 0 12px 10px;
        }

        .xg-docs-nav-item {
          display: flex;
          width: 100%;
          align-items: center;
          gap: 11px;
          padding: 11px 10px;
          margin: 3px 0;
          border: 1px solid transparent;
          border-radius: 8px;
          background: transparent;
          color: #9AA1AC;
          text-align: left;
          font-size: 12px;
          transition: all .25s ease;
        }

        .xg-docs-nav-item:hover {
          color: white;
          background: rgba(255,255,255,.035);
          transform: translateX(3px);
        }

        .xg-docs-nav-item.active {
          color: #FDBA74;
          background: rgba(249,115,22,.09);
          border-color: rgba(249,115,22,.16);
          position: relative;
        }

        .xg-docs-nav-item.active::before {
          content: "";
          position: absolute;
          left: -1px;
          top: 7px;
          bottom: 7px;
          width: 3px;
          border-radius: 0 4px 4px 0;
          background: var(--xg-orange);
        }

        .xg-docs-nav-item.active svg { color: var(--xg-orange); }
        .xg-docs-nav-item svg { flex-shrink: 0; }

        .xg-docs-sidebar-note {
          margin-top: 40px;
          padding: 16px;
          border: 1px solid var(--xg-border);
          border-radius: 12px;
          background: linear-gradient(145deg,rgba(249,115,22,.08),rgba(255,255,255,.015));
        }

        .xg-docs-sidebar-note svg { color: var(--xg-orange); }

        .xg-docs-sidebar-note strong {
          display: block;
          font-size: 12px;
          margin: 10px 0 6px;
        }

        .xg-docs-sidebar-note p {
          color: var(--xg-muted);
          font-size: 11px;
          line-height: 1.7;
          margin: 0;
        }

        /* Main content leaves space for the fixed sidebar */
        .xg-docs-main {
          min-width: 0;
          width: calc(100% - 265px);
          max-width: 1235px;
          margin-left: 265px;
          padding: 55px clamp(25px, 6vw, 95px) 100px;
        }

        .xg-docs-hero {
          position: relative;
          overflow: hidden;
          padding: 46px;
          border: 1px solid rgba(249,115,22,.17);
          border-radius: 18px;
          background:
            radial-gradient(ellipse at 90% 10%,rgba(249,115,22,.15),transparent 42%),
            linear-gradient(135deg,#11151C,#090C11 70%);
          animation: xgDocsFadeUp .7s ease both;
        }

        .xg-docs-hero::after {
          content: "";
          position: absolute;
          width: 260px;
          height: 260px;
          border: 1px solid rgba(249,115,22,.12);
          border-radius: 50%;
          right: -95px;
          top: -110px;
          box-shadow: 0 0 0 25px rgba(249,115,22,.025),
                      0 0 0 55px rgba(249,115,22,.02);
          pointer-events: none;
        }

        .xg-docs-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          color: var(--xg-orange-light);
          font-size: 10px;
          font-weight: 800;
          letter-spacing: 2px;
          margin-bottom: 19px;
        }

        .xg-docs-eyebrow span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--xg-orange);
          box-shadow: 0 0 12px var(--xg-orange);
        }

        .xg-docs-hero h1 {
          max-width: 650px;
          margin: 0;
          font-size: clamp(32px,5vw,54px);
          line-height: 1.12;
          letter-spacing: -2px;
          font-weight: 850;
        }

        .xg-docs-hero h1 em {
          color: var(--xg-orange);
          font-style: normal;
        }

        .xg-docs-hero p {
          max-width: 590px;
          color: #A2A9B4;
          font-size: 14px;
          line-height: 1.9;
          margin: 20px 0 27px;
        }

        .xg-docs-hero-actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 12px;
        }

        .xg-docs-primary,
        .xg-docs-secondary {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 9px;
          border-radius: 9px;
          padding: 12px 17px;
          font-size: 12px;
          font-weight: 800;
          transition: all .25s ease;
        }

        .xg-docs-primary {
          background: var(--xg-orange);
          color: white;
          border: 1px solid var(--xg-orange);
        }

        .xg-docs-primary:hover {
          background: #EA580C;
          transform: translateY(-3px);
          box-shadow: 0 8px 25px rgba(249,115,22,.2);
        }

        .xg-docs-secondary {
          color: #D1D5DB;
          border: 1px solid var(--xg-border);
          background: rgba(255,255,255,.025);
        }

        .xg-docs-secondary:hover {
          color: white;
          border-color: rgba(249,115,22,.5);
          transform: translateY(-3px);
        }

        .xg-docs-section {
          padding-top: 75px;
          scroll-margin-top: 105px;
          animation: xgDocsFadeUp .65s ease both;
        }

        .xg-docs-section-label {
          color: var(--xg-orange);
          font-size: 9px;
          font-weight: 850;
          letter-spacing: 2px;
          margin-bottom: 12px;
        }

        .xg-docs-section h2 {
          margin: 0 0 13px;
          font-size: clamp(25px,3vw,34px);
          line-height: 1.2;
          letter-spacing: -1px;
        }

        .xg-docs-section-intro {
          max-width: 700px;
          color: var(--xg-muted);
          font-size: 13px;
          line-height: 1.9;
          margin: 0 0 27px;
        }

        .xg-docs-card-grid {
          display: grid;
          grid-template-columns: repeat(2,minmax(0,1fr));
          gap: 14px;
        }

        .xg-docs-card {
          position: relative;
          overflow: hidden;
          padding: 23px;
          border: 1px solid var(--xg-border);
          border-radius: 12px;
          background: var(--xg-card);
          transition: transform .3s ease, border-color .3s ease, background .3s ease;
        }

        .xg-docs-card:hover {
          transform: translateY(-5px);
          border-color: rgba(249,115,22,.35);
          background: #10151C;
        }

        .xg-docs-card-icon {
          width: 39px;
          height: 39px;
          display: grid;
          place-items: center;
          color: var(--xg-orange);
          background: rgba(249,115,22,.1);
          border: 1px solid rgba(249,115,22,.14);
          border-radius: 10px;
          margin-bottom: 17px;
        }

        .xg-docs-card h3 {
          margin: 0 0 9px;
          font-size: 14px;
        }

        .xg-docs-card p {
          color: var(--xg-muted);
          font-size: 12px;
          line-height: 1.8;
          margin: 0;
        }

        .xg-docs-steps { display: grid; gap: 12px; }

        .xg-docs-step {
          display: grid;
          grid-template-columns: 42px 1fr;
          gap: 16px;
          padding: 19px;
          border: 1px solid var(--xg-border);
          border-radius: 11px;
          background: var(--xg-card);
          transition: border-color .25s ease, transform .25s ease;
        }

        .xg-docs-step:hover {
          border-color: rgba(249,115,22,.35);
          transform: translateX(4px);
        }

        .xg-docs-step-number {
          width: 38px;
          height: 38px;
          display: grid;
          place-items: center;
          color: var(--xg-orange-light);
          background: rgba(249,115,22,.1);
          border-radius: 10px;
          font-size: 13px;
          font-weight: 850;
        }

        .xg-docs-step h3 { margin: 2px 0 7px; font-size: 13px; }

        .xg-docs-step p {
          margin: 0;
          color: var(--xg-muted);
          font-size: 12px;
          line-height: 1.8;
        }

        .xg-docs-callout {
          display: flex;
          align-items: flex-start;
          gap: 13px;
          padding: 17px;
          border: 1px solid rgba(249,115,22,.2);
          background: rgba(249,115,22,.055);
          border-radius: 11px;
          margin-top: 20px;
        }

        .xg-docs-callout svg {
          flex-shrink: 0;
          color: var(--xg-orange);
          margin-top: 2px;
        }

        .xg-docs-callout p {
          color: #B8BEC8;
          font-size: 12px;
          line-height: 1.8;
          margin: 0;
        }

        .xg-docs-callout strong { color: #F5F5F5; }

        .xg-docs-code {
          padding: 20px;
          border: 1px solid var(--xg-border);
          border-radius: 11px;
          background: #080B10;
          overflow-x: auto;
        }

        .xg-docs-code-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          color: #9299A5;
          font-size: 10px;
        }

        .xg-docs-code-dots { display: flex; gap: 5px; }

        .xg-docs-code-dots span {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #444B55;
        }

        .xg-docs-code pre {
          margin: 0;
          color: #D5D9E0;
          font: 12px/1.9 Consolas, Monaco, monospace;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
        }

        .xg-docs-code .code-orange { color: #FDBA74; }
        .xg-docs-code .code-green { color: #86EFAC; }
        .xg-docs-code .code-muted { color: #7D8794; }

        .xg-docs-faq-list { display: grid; gap: 10px; }

        .xg-docs-faq {
          border: 1px solid var(--xg-border);
          border-radius: 11px;
          background: var(--xg-card);
          overflow: hidden;
          transition: border-color .25s ease;
        }

        .xg-docs-faq.open { border-color: rgba(249,115,22,.35); }

        .xg-docs-faq button {
          display: flex;
          width: 100%;
          justify-content: space-between;
          align-items: center;
          gap: 15px;
          padding: 18px;
          background: transparent;
          border: 0;
          color: #E5E7EB;
          text-align: left;
          font-size: 12px;
          font-weight: 750;
        }

        .xg-docs-faq button svg {
          flex-shrink: 0;
          color: var(--xg-orange);
          transition: transform .25s ease;
        }

        .xg-docs-faq.open button svg { transform: rotate(180deg); }

        .xg-docs-faq-answer {
          display: grid;
          grid-template-rows: 0fr;
          transition: grid-template-rows .3s ease;
        }

        .xg-docs-faq.open .xg-docs-faq-answer { grid-template-rows: 1fr; }
        .xg-docs-faq-answer > div { overflow: hidden; }

        .xg-docs-faq-answer p {
          color: var(--xg-muted);
          font-size: 12px;
          line-height: 1.9;
          margin: 0;
          padding: 0 18px 18px;
        }

        .xg-docs-bottom-cta {
          margin-top: 80px;
          padding: 35px;
          text-align: center;
          border: 1px solid rgba(249,115,22,.2);
          border-radius: 15px;
          background: radial-gradient(ellipse at 50% 0%,rgba(249,115,22,.13),transparent 70%),#0C1016;
        }

        .xg-docs-bottom-cta svg { color: var(--xg-orange); margin-bottom: 12px; }
        .xg-docs-bottom-cta h2 { font-size: 24px; margin: 0 0 10px; }

        .xg-docs-bottom-cta p {
          color: var(--xg-muted);
          font-size: 12px;
          line-height: 1.8;
          margin: 0 auto 20px;
          max-width: 500px;
        }

        .xg-docs-footer {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          padding: 30px 0 0;
          margin-top: 55px;
          border-top: 1px solid var(--xg-border);
          color: #69717D;
          font-size: 10px;
        }

        .xg-docs-footer a { transition: color .2s ease; }
        .xg-docs-footer a:hover { color: var(--xg-orange); }

        .xg-docs-scrolltop {
          position: fixed;
          right: 25px;
          bottom: 25px;
          width: 43px;
          height: 43px;
          display: grid;
          place-items: center;
          border: 1px solid rgba(249,115,22,.35);
          border-radius: 12px;
          color: white;
          background: #17130F;
          box-shadow: 0 8px 30px rgba(0,0,0,.35);
          z-index: 70;
          animation: xgDocsFadeUp .25s ease both;
          transition: transform .2s ease, background .2s ease;
        }

        .xg-docs-scrolltop:hover {
          background: #F97316;
          transform: translateY(-4px);
        }

        .xg-docs-no-results {
          padding: 20px;
          border: 1px dashed var(--xg-border);
          border-radius: 10px;
          color: var(--xg-muted);
          font-size: 12px;
          line-height: 1.8;
        }

        @keyframes xgDocsFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 1100px) {
          .xg-docs-sidebar {
            width: 225px;
            padding-left: 18px;
            padding-right: 15px;
          }

          .xg-docs-main {
            width: calc(100% - 225px);
            margin-left: 225px;
            padding: 40px 28px 80px;
          }

          .xg-docs-hero { padding: 35px; }
        }

        @media (max-width: 680px) {
          .xg-docs-header { height: 66px; padding: 0 18px; }
          .xg-docs-header-cta { display: none; }
          .xg-docs-menu-button { display: flex; }

          .xg-docs-layout { display: block; }

          .xg-docs-sidebar {
            position: fixed;
            top: calc(66px + var(--banner-offset, 0px));
            left: 0;
            bottom: 0;
            width: min(310px,85vw);
            height: auto;
            z-index: 55;
            background: #080B10;
            border-right: 1px solid var(--xg-border);
            padding: 25px 20px 45px;
            transform: translateX(-105%);
            transition: transform .3s ease;
            box-shadow: 20px 0 50px rgba(0,0,0,.3);
          }

          .xg-docs-sidebar.mobile-open { transform: translateX(0); }

          .xg-docs-main {
            width: 100%;
            max-width: none;
            margin-left: 0;
            padding: 25px 18px 70px;
          }

          .xg-docs-hero { padding: 28px 23px; }
          .xg-docs-hero h1 { letter-spacing: -1.3px; }
          .xg-docs-hero p { font-size: 13px; }
          .xg-docs-section { padding-top: 58px; scroll-margin-top: 85px; }
          .xg-docs-card-grid { grid-template-columns: 1fr; }
          .xg-docs-bottom-cta { padding: 28px 20px; }
          .xg-docs-footer { flex-direction: column; }
        }

        /* Large desktop monitors only */
        @media (min-width: 1920px) {
          .xg-docs-header {
            height: 86px;
            padding-left: max(6%, calc((100vw - 1900px) / 2));
            padding-right: max(6%, calc((100vw - 1900px) / 2));
          }

          .xg-docs-layout {
            max-width: 1900px;
            min-height: calc(100vh - 86px);
          }

          .xg-docs-sidebar {
            top: calc(86px + var(--banner-offset, 0px));
            left: max(0px, calc((100vw - 1900px) / 2));
            width: 310px;
            padding: 45px 26px 70px;
          }

          .xg-docs-main {
            width: calc(100% - 310px);
            max-width: 1590px;
            margin-left: 310px;
            padding: 70px 90px 120px;
          }

          .xg-docs-hero {
            padding: 60px;
            border-radius: 20px;
          }

          .xg-docs-hero h1 {
            max-width: 800px;
          }

          .xg-docs-hero p {
            max-width: 720px;
          }

          .xg-docs-section {
            padding-top: 90px;
          }

          .xg-docs-section-intro {
            max-width: 850px;
            margin-bottom: 34px;
          }

          .xg-docs-card-grid {
            gap: 20px;
          }

          .xg-docs-card {
            padding: 30px;
          }

          .xg-docs-steps {
            gap: 16px;
          }

          .xg-docs-step {
            padding: 24px;
            gap: 20px;
          }

          .xg-docs-callout {
            padding: 22px;
          }

          .xg-docs-code {
            padding: 26px;
          }

          .xg-docs-faq-list {
            gap: 14px;
          }

          .xg-docs-faq button {
            padding: 22px;
          }

          .xg-docs-faq-answer p {
            padding: 0 22px 22px;
          }

          .xg-docs-bottom-cta {
            margin-top: 100px;
            padding: 48px;
          }

          .xg-docs-footer {
            margin-top: 70px;
            padding-top: 36px;
          }
        }

        /* Extra-wide monitors */
        @media (min-width: 2560px) {
          .xg-docs-header {
            height: 92px;
          }

          .xg-docs-layout {
            max-width: 2200px;
            min-height: calc(100vh - 92px);
          }

          .xg-docs-sidebar {
            top: calc(92px + var(--banner-offset, 0px));
            left: max(0px, calc((100vw - 2200px) / 2));
            width: 350px;
            padding: 52px 30px 80px;
          }

          .xg-docs-main {
            width: calc(100% - 350px);
            max-width: 1850px;
            margin-left: 350px;
            padding: 85px 110px 140px;
          }

          .xg-docs-hero {
            padding: 72px;
          }

          .xg-docs-section {
            padding-top: 105px;
          }

          .xg-docs-card-grid {
            gap: 24px;
          }

          .xg-docs-card {
            padding: 36px;
          }

          .xg-docs-steps {
            gap: 19px;
          }

          .xg-docs-step {
            padding: 28px;
          }

          .xg-docs-callout {
            padding: 26px;
          }

          .xg-docs-code {
            padding: 32px;
          }

          .xg-docs-bottom-cta {
            padding: 58px;
            margin-top: 115px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .xg-docs *,
          .xg-docs *::before,
          .xg-docs *::after {
            animation-duration: .01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: .01ms !important;
          }
        }
      `}</style>

      <header className="xg-docs-header">
        <Link to="/" className="xg-docs-brand">
          <span className="xg-docs-brand-mark">
            <Layers3 size={20} />
          </span>
          <span>
            XOGrid
            <small>DOCUMENTATION</small>
          </span>
        </Link>

        <div className="xg-docs-header-right">
          <Link to="/" className="xg-docs-back">
            <ArrowLeft size={15} />
            Back to XOGrid
          </Link>

          <Link to="/explore" className="xg-docs-header-cta">
            Explore Templates
            <ArrowUpRight size={15} />
          </Link>

          <button
            type="button"
            className="xg-docs-menu-button"
            onClick={() => setMobileMenuOpen((value) => !value)}
            aria-label={mobileMenuOpen ? "Close navigation" : "Open navigation"}
          >
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      <div className="xg-docs-layout">
        <aside className={`xg-docs-sidebar ${mobileMenuOpen ? "mobile-open" : ""}`}>
          <div className="xg-docs-search">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search documentation..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              aria-label="Search documentation sections"
            />
          </div>

          {groups.map((group) => {
            const items = filteredSections.filter(
              (section) => section.group === group
            );

            if (!items.length) return null;

            return (
              <div className="xg-docs-nav-group" key={group}>
                <p className="xg-docs-nav-heading">{group}</p>

                {items.map((section) => {
                  const Icon = section.icon;

                  return (
                    <button
                      type="button"
                      key={section.id}
                      onClick={() => navigateToSection(section.id)}
                      className={`xg-docs-nav-item ${
                        activeSection === section.id ? "active" : ""
                      }`}
                      aria-current={activeSection === section.id ? "location" : undefined}
                    >
                      <Icon size={15} />
                      <span>{section.label}</span>
                      {activeSection === section.id && (
                        <ChevronRight size={13} style={{ marginLeft: "auto" }} />
                      )}
                    </button>
                  );
                })}
              </div>
            );
          })}

          {filteredSections.length === 0 && (
            <div className="xg-docs-no-results">
              No matching sections found. Try another search term.
            </div>
          )}

          <div className="xg-docs-sidebar-note">
            <Sparkles size={18} />
            <strong>Building with XOGrid?</strong>
            <p>
              Explore the platform, discover templates, and contribute to the
              Bitcoin Cash ecosystem.
            </p>
          </div>
        </aside>

        <main className="xg-docs-main">
          <section className="xg-docs-hero" id="top">
            <div className="xg-docs-eyebrow">
              <span />
              THE XOGRID KNOWLEDGE BASE
            </div>

            <h1>
              Everything you need to
              <br />
              <em>build with XOGrid.</em>
            </h1>

            <p>
              Welcome to the XOGrid documentation center. Learn how to explore
              templates, publish resources, connect your wallet, and understand
              the tools that support the BCH ecosystem.
            </p>

            <div className="xg-docs-hero-actions">
              <button
                type="button"
                className="xg-docs-primary"
                onClick={() => navigateToSection("getting-started")}
              >
                Get Started
                <ArrowRight size={15} />
              </button>

              <button
                type="button"
                className="xg-docs-secondary"
                onClick={() => navigateToSection("faq")}
              >
                Browse FAQs
                <ArrowDown size={14} />
              </button>
            </div>
          </section>

          <section className="xg-docs-section" id="overview">
            <div className="xg-docs-section-label">01 / INTRODUCTION</div>
            <h2>Welcome to XOGrid</h2>
            <p className="xg-docs-section-intro">
              XOGrid is a template registry designed for the Bitcoin Cash
              ecosystem. It brings discovery, publishing, and trust-related
              information into one platform.
            </p>

            <div className="xg-docs-card-grid">
              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Compass size={19} /></div>
                <h3>Discover</h3>
                <p>Explore available templates and review the information provided by their publishers.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Layers3 size={19} /></div>
                <h3>Publish</h3>
                <p>Share templates with the ecosystem by providing useful and accurate submission details.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><ShieldCheck size={19} /></div>
                <h3>Build Trust</h3>
                <p>Review verification information and community feedback when evaluating templates.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Code2 size={19} /></div>
                <h3>Build and Integrate</h3>
                <p>Use the platform's available resources to understand how XOGrid fits into your development workflow.</p>
              </article>
            </div>
          </section>

          <section className="xg-docs-section" id="getting-started">
            <div className="xg-docs-section-label">02 / FIRST STEPS</div>
            <h2>Getting started</h2>
            <p className="xg-docs-section-intro">
              New to XOGrid? Follow these steps to get familiar with the platform.
            </p>

            <div className="xg-docs-steps">
              {[
                {
                  title: "Visit the XOGrid platform",
                  text: "Start from the homepage to understand the platform and the resources available.",
                },
                {
                  title: "Explore the template registry",
                  text: "Open Explore to browse available templates and inspect their published information.",
                },
                {
                  title: "Connect your wallet when needed",
                  text: "Use the wallet connection option when accessing features that require wallet interaction.",
                },
                {
                  title: "Publish or contribute",
                  text: "When you are ready, visit the Publish page and follow the submission instructions.",
                },
              ].map((step, index) => (
                <div className="xg-docs-step" key={step.title}>
                  <div className="xg-docs-step-number">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="xg-docs-section" id="wallet">
            <div className="xg-docs-section-label">03 / WALLET</div>
            <h2>Wallet connection</h2>
            <p className="xg-docs-section-intro">
              XOGrid uses wallet connectivity for platform actions that need
              wallet access. Your wallet is controlled by you; always review
              connection and transaction prompts before approving them.
            </p>

            <div className="xg-docs-card-grid">
              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Wallet size={19} /></div>
                <h3>Connect</h3>
                <p>Use the platform's Connect Wallet option and select a supported wallet provider.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><CheckCircle2 size={19} /></div>
                <h3>Review permissions</h3>
                <p>Review the wallet connection request and approve only actions you understand.</p>
              </article>
            </div>

            <div className="xg-docs-callout">
              <ShieldCheck size={19} />
              <p>
                <strong>Security reminder:</strong> Never share your recovery
                phrase or private keys. XOGrid support will never need them.
              </p>
            </div>
          </section>

          <section className="xg-docs-section" id="explore">
            <div className="xg-docs-section-label">04 / DISCOVERY</div>
            <h2>Exploring templates</h2>
            <p className="xg-docs-section-intro">
              The Explore page is where you can discover resources published to
              the XOGrid registry.
            </p>

            <div className="xg-docs-steps">
              <div className="xg-docs-step">
                <div className="xg-docs-step-number"><Search size={17} /></div>
                <div>
                  <h3>Find what you need</h3>
                  <p>Browse the available registry entries and use the discovery tools provided by the platform.</p>
                </div>
              </div>

              <div className="xg-docs-step">
                <div className="xg-docs-step-number"><FileText size={17} /></div>
                <div>
                  <h3>Review template details</h3>
                  <p>Open a template's detail page to inspect its description, publisher information, and other available details.</p>
                </div>
              </div>

              <div className="xg-docs-step">
                <div className="xg-docs-step-number"><ShieldCheck size={17} /></div>
                <div>
                  <h3>Evaluate available trust information</h3>
                  <p>Check the verification and community information displayed by the platform before relying on a resource.</p>
                </div>
              </div>
            </div>

            <div style={{ marginTop: 20 }}>
              <Link to="/explore" className="xg-docs-primary">
                Open Explore
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <section className="xg-docs-section" id="publishing">
            <div className="xg-docs-section-label">05 / CONTRIBUTING</div>
            <h2>Publishing templates</h2>
            <p className="xg-docs-section-intro">
              XOGrid gives contributors a place to submit templates for the
              ecosystem. Clear descriptions and accurate information make
              submissions easier for others to understand.
            </p>

            <div className="xg-docs-steps">
              {[
                {
                  title: "Open the Publish page",
                  text: "Navigate to Publish from the platform.",
                },
                {
                  title: "Connect your wallet",
                  text: "Connect a supported wallet if the publishing workflow requests it.",
                },
                {
                  title: "Complete the submission details",
                  text: "Provide the requested template information. Make sure descriptions and links are accurate.",
                },
                {
                  title: "Review before submitting",
                  text: "Check the information you entered and follow the submission flow displayed by XOGrid.",
                },
              ].map((step, index) => (
                <div className="xg-docs-step" key={step.title}>
                  <div className="xg-docs-step-number">{String(index + 1).padStart(2, "0")}</div>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ marginTop: 20 }}>
              <Link to="/publish" className="xg-docs-primary">
                Publish a Template
                <ArrowUpRight size={15} />
              </Link>
            </div>
          </section>

          <section className="xg-docs-section" id="verification">
            <div className="xg-docs-section-label">06 / TRUST & SAFETY</div>
            <h2>Verification and trust</h2>
            <p className="xg-docs-section-intro">
              Trust-related information helps users understand what is known
              about a template. XOGrid's registry interface may display
              automated checks, review status, and community feedback.
            </p>

            <div className="xg-docs-card-grid">
              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Zap size={19} /></div>
                <h3>Automated checks</h3>
                <p>Review the automated check results displayed for a template. A check result should be interpreted according to its accompanying details.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><ShieldCheck size={19} /></div>
                <h3>Review status</h3>
                <p>Look at the displayed review status to understand whether information has been checked or reviewed.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Users size={19} /></div>
                <h3>Community reports</h3>
                <p>Community feedback can help highlight concerns or information that deserves further attention.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><CheckCircle2 size={19} /></div>
                <h3>Make informed decisions</h3>
                <p>Review the available evidence and details yourself. A verification indicator is not a guarantee of safety.</p>
              </article>
            </div>

            <div className="xg-docs-callout">
              <HelpCircle size={19} />
              <p>
                <strong>Important:</strong> Verification and trust indicators
                should support your own evaluation, not replace it.
              </p>
            </div>
          </section>

          <section className="xg-docs-section" id="developers">
            <div className="xg-docs-section-label">07 / DEVELOPERS</div>
            <h2>Developer guide</h2>
            <p className="xg-docs-section-intro">
              Developers integrating with XOGrid should use the technical
              documentation supplied for the deployed backend and frontend.
              The following is a general starting point, not an API specification.
            </p>

            <div className="xg-docs-card-grid">
              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><Code2 size={19} /></div>
                <h3>Integration details</h3>
                <p>Confirm the supported API routes, request methods, payloads, and response formats with the backend documentation.</p>
              </article>

              <article className="xg-docs-card">
                <div className="xg-docs-card-icon"><ShieldCheck size={19} /></div>
                <h3>Authentication</h3>
                <p>Confirm the authentication and authorization requirements before building integrations that access protected features.</p>
              </article>
            </div>

            <div className="xg-docs-code" style={{ marginTop: 17 }}>
              <div className="xg-docs-code-top">
                <span>INTEGRATION CHECKLIST</span>
                <div className="xg-docs-code-dots"><span /><span /><span /></div>
              </div>
              <pre>
                <span className="code-muted">// Confirm these details with the XOGrid backend team</span>{"\n"}
                <span className="code-orange">API_BASE_URL</span>{"\n"}
                <span className="code-orange">AVAILABLE_ENDPOINTS</span>{"\n"}
                <span className="code-orange">AUTHENTICATION_METHOD</span>{"\n"}
                <span className="code-orange">REQUEST_AND_RESPONSE_SCHEMAS</span>{"\n"}
                <span className="code-orange">ERROR_HANDLING</span>{"\n"}
                <span className="code-green">WALLET_INTEGRATION_REQUIREMENTS</span>
              </pre>
            </div>

            <div className="xg-docs-callout">
              <Code2 size={19} />
              <p>
                <strong>Backend documentation needed:</strong> Actual endpoint
                URLs, authentication rules, and request examples have not been
                specified in this page. Add the verified backend specification
                before publishing API instructions.
              </p>
            </div>
          </section>

          <section className="xg-docs-section" id="faq">
            <div className="xg-docs-section-label">08 / HELP CENTER</div>
            <h2>Frequently asked questions</h2>
            <p className="xg-docs-section-intro">
              Quick answers to common questions about using XOGrid.
            </p>

            <div className="xg-docs-faq-list">
              {faqs.map((faq, index) => (
                <div
                  className={`xg-docs-faq ${openFaq === index ? "open" : ""}`}
                  key={faq.question}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(openFaq === index ? null : index)}
                    aria-expanded={openFaq === index}
                  >
                    <span>{faq.question}</span>
                    <ChevronDown size={17} />
                  </button>

                  <div className="xg-docs-faq-answer">
                    <div><p>{faq.answer}</p></div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="xg-docs-bottom-cta">
            <Sparkles size={25} />
            <h2>Ready to explore XOGrid?</h2>
            <p>
              Discover templates, learn from the ecosystem, and contribute
              resources to the Bitcoin Cash community.
            </p>
            <Link to="/explore" className="xg-docs-primary">
              Explore Templates
              <ArrowRight size={15} />
            </Link>
          </section>

          <footer className="xg-docs-footer">
            <span>© {new Date().getFullYear()} XOGrid. All rights reserved.</span>
            <div style={{ display: "flex", gap: 18 }}>
              <Link to="/">Home</Link>
              <Link to="/policy">Policy</Link>
              <Link to="/explore">Explore</Link>
            </div>
          </footer>
        </main>
      </div>

      {showScrollTop && (
        <button
          type="button"
          className="xg-docs-scrolltop"
          onClick={scrollToTop}
          aria-label="Scroll to top"
        >
          <ArrowUpRight size={19} />
        </button>
      )}
    </div>
  );
}

export default Documentation;
