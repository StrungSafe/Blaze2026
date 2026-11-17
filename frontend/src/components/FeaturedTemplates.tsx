
import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import {
  ArrowUpRight,
  Copy,
  Check,
  ShieldCheck,
  Sparkles,
  Search,
  RefreshCw,
  AlertCircle,
  Layers3,
} from "lucide-react";
import { Link } from "react-router-dom";

const API_URL = import.meta.env.VITE_API_URL || "";

interface Template {
  name?: string;
  description?: string;
  identifier: string;
  badge?: string;
  flagged?: boolean;
  blurb?: string;
}

interface SpotlightResponse {
  items?: Template[];
}

interface BadgeStyle {
  label: string;
  className: string;
  dot: string;
}

const badgeStyles: Record<string, BadgeStyle> = {
  unchecked: {
    label: "Unchecked",
    className: "border-white/10 bg-white/[0.04] text-white/50",
    dot: "bg-white/40",
  },
  "auto-checked": {
    label: "Auto-checked",
    className: "border-cyan-500/20 bg-cyan-500/[0.07] text-cyan-400",
    dot: "bg-cyan-400",
  },
  reviewed: {
    label: "Reviewed",
    className: "border-emerald-500/20 bg-emerald-500/[0.07] text-emerald-400",
    dot: "bg-emerald-400",
  },
};

function getBadge(value: string | undefined): BadgeStyle {
  const normalized = String(value || "unchecked")
    .toLowerCase()
    .replaceAll("_", "-");

  return badgeStyles[normalized] ?? badgeStyles.unchecked;
}

function FeaturedTemplates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchSpotlight = async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");

      const response = await fetch(`${API_URL}/api/spotlight`);

      if (!response.ok) {
        throw new Error("Unable to load featured templates.");
      }

      const data: SpotlightResponse = await response.json();

      setTemplates(Array.isArray(data.items) ? data.items : []);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while loading templates."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchSpotlight();
  }, []);

  const filteredTemplates = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();

    if (!query) return templates;

    return templates.filter((template) => {
      const name = template.name || "";
      const description = template.description || "";
      const identifier = template.identifier || "";

      return (
        name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query) ||
        identifier.toLowerCase().includes(query)
      );
    });
  }, [templates, searchQuery]);

  const copyIdentifier = async (identifier: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(identifier);
      setCopiedId(identifier);

      window.setTimeout(() => {
        setCopiedId((current) =>
          current === identifier ? null : current
        );
      }, 1800);
    } catch {
      setCopiedId(null);
    }
  };

  const handleSearchChange = (
    event: ChangeEvent<HTMLInputElement>
  ): void => {
    setSearchQuery(event.target.value);
  };

  return (
    <section
      id="featured-templates"
      className="relative overflow-hidden px-5 py-24 sm:px-8 lg:px-12"
    >
      {/* Ambient lighting */}
      <div className="pointer-events-none absolute -left-40 top-20 h-80 w-80 rounded-full bg-violet-600/[0.07] blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 bottom-10 h-80 w-80 rounded-full bg-orange-500/[0.06] blur-[120px]" />

      <div className="relative mx-auto max-w-[1400px]">
        {/* Heading */}
        <div className="mb-10 flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
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
              Discover reusable XO wallet templates. Inspect their
              structure, automated checks and community feedback
              before deciding whether to use them.
            </p>
          </div>

          <Link
            to="/explore"
            className="group inline-flex w-fit items-center gap-3 rounded-xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-500/15 transition-all duration-300 hover:-translate-y-1 hover:bg-orange-400 hover:shadow-orange-500/25"
          >
            Browse all templates

            <ArrowUpRight
              size={17}
              className="transition-transform duration-300 group-hover:-translate-y-1 group-hover:translate-x-1"
            />
          </Link>
        </div>

        {/* Search */}
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <Search
              size={17}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30"
            />

            <input
              type="search"
              value={searchQuery}
              onChange={handleSearchChange}
              placeholder="Search featured templates..."
              aria-label="Search featured templates"
              className="h-12 w-full rounded-xl border border-white/[0.08] bg-white/[0.025] pl-11 pr-4 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-orange-500/40 focus:ring-2 focus:ring-orange-500/10"
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-white/35">
            <Layers3 size={15} />
            Admin-selected spotlight
          </div>
        </div>

        {/* Count */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-xs font-medium text-white/40">
            Showing{" "}
            <span className="text-white">
              {loading ? "—" : filteredTemplates.length}
            </span>{" "}
            featured templates
          </p>

          <span className="text-[10px] uppercase tracking-[0.15em] text-white/25">
            XO registry
          </span>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="animate-pulse rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5"
              >
                <div className="h-11 w-11 rounded-xl bg-white/[0.07]" />
                <div className="mt-6 h-5 w-2/3 rounded bg-white/[0.07]" />
                <div className="mt-3 h-3 w-full rounded bg-white/[0.05]" />
                <div className="mt-2 h-3 w-4/5 rounded bg-white/[0.05]" />
                <div className="mt-7 h-16 rounded-xl bg-white/[0.04]" />
                <div className="mt-5 h-8 rounded bg-white/[0.04]" />
              </div>
            ))}
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/[0.04] px-6 py-12 text-center">
            <AlertCircle
              size={26}
              className="mx-auto mb-4 text-red-400"
            />

            <h3 className="text-base font-semibold text-white">
              Couldn't load featured templates
            </h3>

            <p className="mt-2 text-sm text-white/40">
              {error}
            </p>

            <button
              type="button"
              onClick={() => void fetchSpotlight()}
              className="mt-5 inline-flex items-center gap-2 rounded-lg bg-orange-500 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-orange-400"
            >
              <RefreshCw size={14} />
              Try again
            </button>
          </div>
        )}

        {/* Template cards */}
        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredTemplates.map((template, index) => {
              const identifier = template.identifier;
              const badge = getBadge(template.badge);

              return (
                <article
                  key={identifier}
                  style={{ animationDelay: `${index * 120}ms` }}
                  className="featured-card group relative flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 opacity-0 transition-all duration-300 hover:-translate-y-1.5 hover:border-orange-500/35 hover:bg-white/[0.045] hover:shadow-[0_18px_50px_rgba(0,0,0,0.20)]"
                >
                  {/* Top accent */}
                  <div className="absolute left-0 top-0 h-[2px] w-0 bg-gradient-to-r from-orange-400 to-violet-500 transition-all duration-500 group-hover:w-full" />

                  {/* Card heading */}
                  <div className="flex items-center justify-between">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-orange-500/10 bg-orange-500/[0.05] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                      <ShieldCheck
                        size={21}
                        className="text-orange-400"
                      />
                    </div>

                    <span className="rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-1 text-[10px] font-medium text-white/45">
                      XO Template
                    </span>
                  </div>

                  {/* Details */}
                  <div className="mt-5">
                    <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-orange-400">
                      {template.name || "Untitled template"}
                    </h3>

                    <p className="mt-2 min-h-[48px] text-xs leading-6 text-white/40">
                      {template.description ||
                        "Explore this template's structure and available information."}
                    </p>
                  </div>

                  {/* Identifier */}
                  <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.015] px-3.5 py-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[9px] font-semibold uppercase tracking-[0.16em] text-white/30">
                        Template identifier
                      </span>

                      {identifier && (
                        <button
                          type="button"
                          onClick={() => void copyIdentifier(identifier)}
                          aria-label="Copy template identifier"
                          className="rounded-md p-1 text-white/35 transition-colors hover:bg-white/10 hover:text-orange-400"
                        >
                          {copiedId === identifier ? (
                            <Check
                              size={13}
                              className="text-emerald-400"
                            />
                          ) : (
                            <Copy size={13} />
                          )}
                        </button>
                      )}
                    </div>

                    <code className="block truncate text-[11px] text-white/65">
                      {identifier || "Identifier unavailable"}
                    </code>
                  </div>

                  {/* Badge and flags */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-[11px] text-white/40">
                      Registry status
                    </span>

                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${badge.className}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${badge.dot}`}
                        />
                        {badge.label}
                      </span>

                      {template.flagged && (
                        <span className="rounded-full border border-red-500/20 bg-red-500/[0.07] px-2.5 py-1 text-[10px] font-medium text-red-400">
                          Flagged
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Spotlight blurb */}
                  {template.blurb && (
                    <p className="mt-4 border-l-2 border-orange-500/40 pl-3 text-xs italic leading-6 text-white/45">
                      {template.blurb}
                    </p>
                  )}

                  {/* Inspect */}
                  <Link
                    to={`/t/${identifier}`}
                    className="mt-auto mt-5 flex items-center justify-between border-t border-white/[0.07] pt-4 text-xs font-semibold text-white/55 transition-colors duration-300 hover:text-orange-400"
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
        )}

        {/* Empty spotlight state */}
        {!loading && !error && templates.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 px-6 py-16 text-center">
            <Layers3
              size={28}
              className="mx-auto mb-4 text-white/25"
            />

            <h3 className="text-base font-semibold text-white">
              No featured templates yet
            </h3>

            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-white/40">
              The XOGrid spotlight is waiting for templates to be
              selected. Explore the registry to discover available
              templates.
            </p>

            <Link
              to="/explore"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-xs font-semibold text-white transition hover:bg-orange-400"
            >
              Explore templates
              <ArrowUpRight size={15} />
            </Link>
          </div>
        )}

        {/* No search results */}
        {!loading &&
          !error &&
          templates.length > 0 &&
          filteredTemplates.length === 0 && (
            <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
              <Search
                size={25}
                className="mx-auto mb-4 text-white/25"
              />

              <h3 className="text-base font-semibold text-white">
                No templates found
              </h3>

              <p className="mt-2 text-sm text-white/40">
                Try another search term.
              </p>

              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="mt-5 text-xs font-semibold text-orange-400 transition-colors hover:text-orange-300"
              >
                Clear search
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
            Automated checks and community reviews provide
            information about a template, not a guarantee of safety.
            An unchecked template has not yet received an audit report.
            Always inspect a template and evaluate it against your
            own wallet policy.
          </p>
        </div>
      </div>

      {/* Animations */}
      <style>{`
        @keyframes featuredFadeUp {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .featured-card {
          animation: featuredFadeUp 0.65s ease-out forwards;
        }

        @media (prefers-reduced-motion: reduce) {
          .featured-card {
            animation: none;
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </section>
  );
}

export default FeaturedTemplates;
