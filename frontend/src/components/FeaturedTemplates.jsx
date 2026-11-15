
import { useState } from "react";
import {
  ArrowUpRight,
  Copy,
  Check,
  ShieldCheck,
  Wallet,
  Users,
  Droplets,
  Sparkles,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Link } from "react-router-dom";

const templates = [
  {
    id: "xo-p2pkh-001",
    name: "P2PKH Wallet",
    description:
      "A standard Pay-to-Public-Key-Hash wallet template for BCH transactions.",
    category: "Wallet",
    status: "Unchecked",
    icon: Wallet,
    iconColor: "text-orange-400",
    identifier: "xo_p2pkh_7f82a91c",
  },
  {
    id: "xo-multisig-002",
    name: "Multisig Wallet",
    description:
      "A multi-signature template requiring multiple participants to authorize spending.",
    category: "Security",
    status: "Unchecked",
    icon: Users,
    iconColor: "text-violet-400",
    identifier: "xo_multisig_4b91d20e",
  },
  {
    id: "xo-faucet-003",
    name: "Faucet Template",
    description:
      "A template for distributing small amounts of BCH through controlled transactions.",
    category: "Payments",
    status: "Unchecked",
    icon: Droplets,
    iconColor: "text-cyan-400",
    identifier: "xo_faucet_9d31c72a",
  },
];

const categories = ["All", "Wallet", "Security", "Payments"];

function FeaturedTemplates() {
  const [copiedId, setCopiedId] = useState(null);
  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTemplates = templates.filter((template) => {
    const matchesCategory =
      activeCategory === "All" ||
      template.category === activeCategory;

    const query = searchQuery.toLowerCase().trim();

    const matchesSearch =
      template.name.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query) ||
      template.identifier.toLowerCase().includes(query);

    return matchesCategory && matchesSearch;
  });

  const copyIdentifier = async (identifier) => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopiedId(identifier);

      setTimeout(() => {
        setCopiedId(null);
      }, 1800);
    } catch {
      setCopiedId(null);
    }
  };

  return (
    <section
      id="featured"
      className="relative overflow-hidden px-5 py-24 sm:px-8 lg:px-12"
    >
      <div className="relative mx-auto max-w-[1400px]">

        {/* Section heading */}
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl animate-[fadeUp_0.7s_ease-out_both]">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/[0.06] px-3.5 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-400">
              <Sparkles size={13} />
              The XO ecosystem
            </div>

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
              Explore the{" "}
              <span className="bg-gradient-to-r from-orange-300 via-orange-400 to-amber-500 bg-clip-text text-transparent">
                template hub.
              </span>
            </h2>

            <p className="mt-4 max-w-xl text-sm leading-7 text-white/45 sm:text-base">
              Discover reusable XO wallet templates. Inspect their structure,
              automated checks and community feedback before you use them.
            </p>
          </div>

          <Link
            to="/browse"
            className="group inline-flex w-fit items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-5 py-3 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-1 hover:border-orange-500/40 hover:bg-orange-500/10"
          >
            Browse all templates

            <ArrowUpRight
              size={17}
              className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* Search and category filters */}
        <div className="mb-7 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-md">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search templates..."
              aria-label="Search templates"
              className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="mr-1 flex items-center gap-2 text-xs text-white/35">
              <SlidersHorizontal size={14} />
              Filter
            </div>

            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category)}
                aria-pressed={activeCategory === category}
                className={`rounded-lg px-4 py-2 text-xs font-medium transition-all duration-300 ${
                  activeCategory === category
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-500/15"
                    : "border border-white/[0.07] bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Template count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-medium text-white/40">
            Showing{" "}
            <span className="text-white">
              {filteredTemplates.length}
            </span>{" "}
            templates
          </p>

          <span className="text-[10px] uppercase tracking-[0.15em] text-white/25">
            XO registry
          </span>
        </div>

        {/* Template cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTemplates.map((template, index) => {
            const Icon = template.icon;

            return (
              <article
                key={template.id}
                style={{ animationDelay: `${index * 120}ms` }}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 opacity-0 animate-[fadeUp_0.65s_ease-out_forwards] transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500/35 hover:bg-white/[0.045] hover:shadow-[0_18px_50px_rgba(0,0,0,0.20)]"
              >
                {/* Animated top accent */}
                <div className="absolute left-0 top-0 h-[2px] w-0 bg-gradient-to-r from-orange-400 to-violet-500 transition-all duration-500 group-hover:w-full" />

                {/* Card heading */}
                <div className="flex items-center justify-between">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.035] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                    <Icon
                      size={21}
                      className={template.iconColor}
                    />
                  </div>

                  <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-medium text-white/45">
                    {template.category}
                  </span>
                </div>

                {/* Template details */}
                <div className="mt-5">
                  <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-orange-400">
                    {template.name}
                  </h3>

                  <p className="mt-2 min-h-[48px] text-xs leading-6 text-white/40">
                    {template.description}
                  </p>
                </div>

                {/* Template identifier */}
                <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">
                      Template ID
                    </span>

                    <button
                      type="button"
                      onClick={() => copyIdentifier(template.identifier)}
                      className="rounded-md p-1 text-white/35 transition-colors hover:bg-white/10 hover:text-orange-400"
                      aria-label="Copy template identifier"
                    >
                      {copiedId === template.identifier ? (
                        <Check
                          size={13}
                          className="text-emerald-400"
                        />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                  </div>

                  <code className="block truncate text-[11px] text-white/65">
                    {template.identifier}
                  </code>
                </div>

                {/* Audit status */}
                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck
                      size={14}
                      className="text-yellow-400/70"
                    />

                    <span className="text-[11px] text-white/40">
                      Audit status
                    </span>
                  </div>

                  <span className="rounded-full border border-yellow-500/15 bg-yellow-500/[0.06] px-2.5 py-1 text-[10px] font-medium text-yellow-400">
                    {template.status}
                  </span>
                </div>

                {/* Inspect template */}
                <Link
                  to={`/templates/${template.identifier}`}
                  className="mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs font-semibold text-white/55 transition-colors duration-300 hover:text-orange-400"
                >
                  Inspect template

                  <ArrowUpRight
                    size={16}
                    className="transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </Link>
              </article>
            );
          })}
        </div>

        {/* Empty search state */}
        {filteredTemplates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
            <Search
              size={25}
              className="mx-auto mb-4 text-white/25"
            />

            <h3 className="text-base font-semibold text-white">
              No templates found
            </h3>

            <p className="mt-2 text-sm text-white/40">
              Try another search term or category.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setActiveCategory("All");
              }}
              className="mt-5 text-xs font-semibold text-orange-400 transition-colors hover:text-orange-300"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Trust note */}
        <div className="mt-7 flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 sm:items-center sm:p-5">
          <ShieldCheck
            size={19}
            className="mt-0.5 shrink-0 text-orange-400 sm:mt-0"
          />

          <p className="text-[11px] leading-6 text-white/40 sm:text-xs">
            Audit badges describe automated checks and community activity.
            An unchecked template has not received an audit report.
            No badge guarantees that a template is safe.
          </p>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
          }
        }
      `}</style>
    </section>
  );
}

export default FeaturedTemplates;
