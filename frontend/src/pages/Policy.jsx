
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Fingerprint,
  ScanSearch,
  Users,
  Flag,
  CheckCircle2,
  AlertTriangle,
  Clock3,
  XCircle,
  LockKeyhole,
  FileCheck2,
  Info,
  ChevronDown,
  Sparkles,
  Scale,
  Eye,
} from "lucide-react";

const policySteps = [
  {
    number: "01",
    title: "Template identity",
    description:
      "Every template receives a unique, content-addressed identifier generated from its canonical representation.",
    icon: Fingerprint,
    color: "text-violet-400",
    background: "bg-violet-500/10",
  },
  {
    number: "02",
    title: "Automated checks",
    description:
      "Templates go through automated validation checks covering structure, size, references, compilation, and scenarios.",
    icon: ScanSearch,
    color: "text-orange-400",
    background: "bg-orange-500/10",
  },
  {
    number: "03",
    title: "Community accountability",
    description:
      "Users can flag templates and qualified reviewers can provide human reviews tied to a specific template identity.",
    icon: Users,
    color: "text-blue-400",
    background: "bg-blue-500/10",
  },
  {
    number: "04",
    title: "Your policy decision",
    description:
      "Use the available evidence to decide whether a template meets your own requirements before using it.",
    icon: Scale,
    color: "text-emerald-400",
    background: "bg-emerald-500/10",
  },
];

const badges = [
  {
    title: "Unchecked",
    description:
      "No automated audit has been completed for this template.",
    detail: "No audit result available",
    icon: Clock3,
    color: "text-slate-300",
    background: "bg-slate-400/10",
    border: "border-slate-400/20",
  },
  {
    title: "Auto-checked",
    description:
      "The latest automated audit completed without reporting failures.",
    detail: "Automated checks passed",
    icon: CheckCircle2,
    color: "text-emerald-400",
    background: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    title: "Reviewed",
    description:
      "A human reviewer has reviewed this exact template identifier.",
    detail: "Human review recorded",
    icon: Eye,
    color: "text-blue-400",
    background: "bg-blue-500/10",
    border: "border-blue-500/20",
  },
  {
    title: "Flagged",
    description:
      "An open community flag has been submitted for this template.",
    detail: "Open community report",
    icon: Flag,
    color: "text-orange-400",
    background: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  {
    title: "Removed",
    description:
      "The template has been removed from normal registry availability by a moderator.",
    detail: "Moderator removal",
    icon: XCircle,
    color: "text-red-400",
    background: "bg-red-500/10",
    border: "border-red-500/20",
  },
];

const faqs = [
  {
    question: "Does Auto-checked mean a template is safe?",
    answer:
      "No. Auto-checked only means the latest automated audit completed without reporting failures. Automated checks cannot guarantee that a template is safe, secure, or suitable for every use case.",
  },
  {
    question: "Can a template change after it has been reviewed?",
    answer:
      "A template's identifier is derived from its canonical content. If its content changes, it receives a different identifier. Reviews and audit results are associated with the specific identifier they concern.",
  },
  {
    question: "What happens when someone flags a template?",
    answer:
      "An open community flag is reflected in the template's registry status. Flags provide useful information for users and moderators, but a flag is not automatically proof of malicious behavior.",
  },
  {
    question: "Does XOGrid store my wallet keys or funds?",
    answer:
      "No. XOGrid is a template registry, not a wallet or custodian. It does not hold your private keys or funds. Signing happens through your own wallet when using supported wallet functionality.",
  },
  {
    question: "Who decides whether a template should be used?",
    answer:
      "You do. XOGrid provides template identity, automated check results, community flags, and human review information. You remain responsible for evaluating whether a template meets your requirements.",
  },
];

function SectionHeading({ eyebrow, title, description }) {
  return (
    <div className="max-w-2xl">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-500">
        {eyebrow}
      </p>

      <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl md:text-4xl">
        {title}
      </h2>

      {description && (
        <p className="mt-4 text-sm leading-7 text-slate-400 sm:text-base">
          {description}
        </p>
      )}
    </div>
  );
}

function Policy() {
  const [openFaq, setOpenFaq] = useState(0);

  // Reveal sections as they enter the viewport.
  useEffect(() => {
    const elements = document.querySelectorAll(".policy-reveal");

    if (!("IntersectionObserver" in window)) {
      elements.forEach((element) => {
        element.classList.add("policy-visible");
      });
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("policy-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.08,
        rootMargin: "0px 0px -50px 0px",
      }
    );

    elements.forEach((element) => observer.observe(element));

    return () => observer.disconnect();
  }, []);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05070b] text-white">

      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">

        <div className="policy-glow absolute -left-40 top-20 h-96 w-96 rounded-full bg-violet-600/10 blur-[130px]" />

        <div className="policy-glow-reverse absolute -right-40 top-[550px] h-96 w-96 rounded-full bg-orange-500/[0.07] blur-[130px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.12) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      <div className="policy-content relative z-10 mx-auto max-w-7xl px-5 pb-24 pt-8 sm:px-8 lg:px-12">

        {/* Back navigation */}
        <div className="mb-16">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-orange-500"
          >
            <ArrowLeft
              size={17}
              className="transition-transform group-hover:-translate-x-1"
            />
            Back to home
          </Link>
        </div>

        {/* Hero */}
        <section className="policy-reveal relative mb-28 grid items-center gap-14 lg:grid-cols-[1.15fr_0.85fr]">

          <div className="animate-[fadeUp_0.7s_ease-out_both]">
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/[0.07] px-4 py-2 text-xs font-semibold text-violet-300">
              <ShieldCheck size={15} />
              XOGrid registry principles
            </div>

            <h1 className="max-w-3xl text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl md:text-6xl">
              Understand the rules behind{" "}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                template trust.
              </span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-8 text-slate-400 sm:text-lg">
              XOGrid makes wallet templates easier to inspect and evaluate.
              Understand how template identities, automated checks, community
              reports, and human reviews work together before making your own
              decision.
            </p>

            <div className="mt-9 flex flex-wrap gap-4">
              <Link
                to="/publish"
                className="group inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(249,115,22,0.2)]"
              >
                Publish a template
                <ArrowRight
                  size={17}
                  className="transition-transform group-hover:translate-x-1"
                />
              </Link>

              <Link
                to="/"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-6 py-3.5 text-sm font-semibold text-slate-300 transition-colors hover:border-white/20 hover:text-white"
              >
                Explore XOGrid
              </Link>
            </div>
          </div>

          {/* Hero visual */}
          <div className="policy-hero-visual relative mx-auto w-full max-w-md">
            <div className="absolute inset-0 rounded-[2rem] bg-violet-500/10 blur-3xl" />

            <div className="relative rounded-[2rem] border border-white/10 bg-white/[0.035] p-6 shadow-2xl backdrop-blur-xl sm:p-8">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-5">
                <div>
                  <p className="text-xs font-medium text-slate-500">
                    REGISTRY OVERVIEW
                  </p>
                  <h3 className="mt-1 text-lg font-bold">
                    Trust signals
                  </h3>
                </div>

                <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-3 text-violet-300">
                  <ShieldCheck size={22} />
                </div>
              </div>

              <div className="space-y-4 py-6">
                {[
                  {
                    icon: Fingerprint,
                    label: "Content identity",
                    status: "Unique ID",
                    color: "text-violet-400",
                  },
                  {
                    icon: ScanSearch,
                    label: "Automated checks",
                    status: "Audit results",
                    color: "text-orange-400",
                  },
                  {
                    icon: Users,
                    label: "Human review",
                    status: "Community",
                    color: "text-blue-400",
                  },
                ].map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4"
                    >
                      <div className="flex items-center gap-3">
                        <Icon size={19} className={item.color} />

                        <span className="text-sm font-medium text-slate-200">
                          {item.label}
                        </span>
                      </div>

                      <span className="text-xs text-slate-500">
                        {item.status}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="rounded-xl border border-orange-500/15 bg-orange-500/[0.06] p-4">
                <div className="flex items-start gap-3">
                  <Info
                    size={18}
                    className="mt-0.5 shrink-0 text-orange-400"
                  />

                  <p className="text-xs leading-6 text-slate-400">
                    Trust signals provide information for evaluation. They are
                    not a guarantee of safety.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="policy-reveal mb-28">
          <SectionHeading
            eyebrow="The evaluation process"
            title="Four layers of transparency."
            description="XOGrid brings together several independent signals to help users understand a template before deciding whether to use it."
          />

          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {policySteps.map((step) => {
              const Icon = step.icon;

              return (
                <div
                  key={step.number}
                  className="policy-card group relative rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-all duration-300 hover:-translate-y-1 hover:border-violet-400/30 hover:bg-white/[0.045]"
                >
                  <div className="mb-8 flex items-center justify-between">
                    <div
                      className={`rounded-xl p-3 ${step.background} ${step.color}`}
                    >
                      <Icon size={22} />
                    </div>

                    <span className="text-sm font-bold tracking-widest text-slate-600">
                      {step.number}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white">
                    {step.title}
                  </h3>

                  <p className="mt-3 text-sm leading-7 text-slate-400">
                    {step.description}
                  </p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Template identity */}
        <section className="policy-reveal mb-28 grid items-center gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="01 / Template identity"
              title="Every change gets its own identity."
              description="XOGrid uses content-addressed identifiers to make template identity traceable. The identifier is generated from the canonical representation of the template."
            />

            <div className="mt-8 space-y-5">
              <div className="flex gap-4">
                <div className="mt-1 rounded-lg bg-violet-500/10 p-2 text-violet-400">
                  <FileCheck2 size={19} />
                </div>

                <div>
                  <h3 className="font-semibold text-white">
                    Canonical representation
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Templates are parsed and normalized before their identifiers
                    are generated.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 rounded-lg bg-orange-500/10 p-2 text-orange-400">
                  <Fingerprint size={19} />
                </div>

                <div>
                  <h3 className="font-semibold text-white">
                    Content-based identity
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Identical canonical template content produces the same
                    identifier.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="mt-1 rounded-lg bg-blue-500/10 p-2 text-blue-400">
                  <Sparkles size={19} />
                </div>

                <div>
                  <h3 className="font-semibold text-white">
                    Changes create a new identity
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Changing the template content creates a new identifier.
                    Existing reviews and audit results remain tied to the
                    original identity.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="policy-card rounded-2xl border border-white/10 bg-white/[0.025] p-6 sm:p-8">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
              Identity lifecycle
            </p>

            <div className="mt-8 space-y-3">
              {[
                {
                  title: "Template submitted",
                  description: "Original template input",
                  icon: FileCheck2,
                },
                {
                  title: "Canonicalized",
                  description: "Parsed and normalized content",
                  icon: ScanSearch,
                },
                {
                  title: "Identifier generated",
                  description: "Content-addressed identity",
                  icon: Fingerprint,
                },
                {
                  title: "Registered",
                  description: "Stored in the XOGrid registry",
                  icon: CheckCircle2,
                },
              ].map((item, index) => {
                const Icon = item.icon;

                return (
                  <div key={item.title}>
                    <div className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4">
                      <div className="rounded-lg bg-violet-500/10 p-2.5 text-violet-400">
                        <Icon size={19} />
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-white">
                          {item.title}
                        </h4>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.description}
                        </p>
                      </div>

                      <span className="ml-auto text-xs text-slate-600">
                        0{index + 1}
                      </span>
                    </div>

                    {index !== 3 && (
                      <div className="ml-8 h-4 border-l border-dashed border-violet-400/30" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Automated checks */}
        <section className="policy-reveal mb-28">
          <SectionHeading
            eyebrow="02 / Automated checks"
            title="What does XOGrid check?"
            description="Automated audits help identify structural and technical issues. They provide useful signals, but they cannot establish that a template is safe for every situation."
          />

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                title: "Schema validation",
                description:
                  "Checks whether the submitted template follows the expected structure.",
                icon: FileCheck2,
              },
              {
                title: "Identifier verification",
                description:
                  "Checks that the template identifier matches its canonical content.",
                icon: Fingerprint,
              },
              {
                title: "Size limits",
                description:
                  "Checks whether the template stays within supported size limits.",
                icon: ScanSearch,
              },
              {
                title: "Reference checks",
                description:
                  "Checks references used by the template for expected validity.",
                icon: Eye,
              },
              {
                title: "Compilation",
                description:
                  "Checks whether the template can pass the supported compilation process.",
                icon: CheckCircle2,
              },
              {
                title: "Scenario checks",
                description:
                  "Runs supported scenarios to identify unexpected behavior or failures.",
                icon: Scale,
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="policy-card rounded-2xl border border-white/[0.08] bg-white/[0.025] p-6 transition-colors hover:border-orange-500/20"
                >
                  <div className="mb-5 inline-flex rounded-xl bg-orange-500/10 p-3 text-orange-400">
                    <Icon size={21} />
                  </div>

                  <h3 className="font-bold text-white">{item.title}</h3>

                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-7 flex gap-4 rounded-2xl border border-orange-500/20 bg-orange-500/[0.05] p-5 sm:p-6">
            <AlertTriangle
              className="mt-1 shrink-0 text-orange-400"
              size={21}
            />

            <div>
              <h3 className="font-semibold text-orange-300">
                Important limitation
              </h3>
              <p className="mt-2 text-sm leading-7 text-slate-400">
                Passing automated checks does not mean a template is safe,
                secure, audited by a human, or suitable for your intended use.
                Always inspect the template and make your own decision.
              </p>
            </div>
          </div>
        </section>

        {/* Registry badges */}
        <section className="policy-reveal mb-28">
          <SectionHeading
            eyebrow="03 / Registry badges"
            title="Understand every registry status."
            description="Badges communicate the current information available about a template. Each status has a specific meaning and should be interpreted carefully."
          />

          <div className="mt-12 space-y-4">
            {badges.map((badge) => {
              const Icon = badge.icon;

              return (
                <div
                  key={badge.title}
                  className={`policy-card flex flex-col gap-4 rounded-2xl border ${badge.border} bg-white/[0.025] p-5 transition-colors hover:bg-white/[0.045] sm:flex-row sm:items-center sm:p-6`}
                >
                  <div
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${badge.background} ${badge.color}`}
                  >
                    <Icon size={22} />
                  </div>

                  <div className="flex-1">
                    <h3 className="font-bold text-white">
                      {badge.title}
                    </h3>
                    <p className="mt-1 text-sm leading-6 text-slate-400">
                      {badge.description}
                    </p>
                  </div>

                  <div className="sm:min-w-44 sm:text-right">
                    <span
                      className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${badge.background} ${badge.color}`}
                    >
                      {badge.detail}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="mt-6 text-xs leading-6 text-slate-500">
            Registry status is informational. It does not replace independent
            inspection or your own risk assessment.
          </p>
        </section>

        {/* Policy evaluation */}
        <section className="policy-reveal mb-28">
          <div className="relative overflow-hidden rounded-3xl border border-violet-400/20 bg-violet-500/[0.045] p-7 sm:p-10 lg:p-12">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-[90px]" />

            <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[1fr_0.8fr]">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.25em] text-orange-500">
                  04 / Your policy
                </p>

                <h2 className="max-w-xl text-3xl font-bold leading-tight sm:text-4xl">
                  Transparency helps you make better decisions.
                </h2>

                <p className="mt-5 max-w-xl text-sm leading-7 text-slate-400 sm:text-base">
                  XOGrid provides the information. Your own policy determines
                  what you accept, reject, or investigate further. A template
                  should never be trusted simply because it has a badge.
                </p>

                <Link
                  to="/browse"
                  className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-bold text-white transition-all hover:bg-orange-600"
                >
                  Browse templates
                  <ArrowRight size={17} />
                </Link>
              </div>

              <div className="policy-card rounded-2xl border border-white/10 bg-[#05070b]/70 p-6 backdrop-blur-xl">
                <div className="mb-6 flex items-center gap-3">
                  <div className="rounded-xl bg-violet-500/10 p-3 text-violet-400">
                    <Scale size={22} />
                  </div>

                  <div>
                    <h3 className="font-bold text-white">
                      Policy considerations
                    </h3>
                    <p className="text-xs text-slate-500">
                      Questions to ask before use
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    "Does the identifier match the template?",
                    "Have automated checks been completed?",
                    "Are there open community flags?",
                    "Is there a human review?",
                    "Does the template meet my requirements?",
                  ].map((item, index) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-violet-400/30 text-[10px] font-bold text-violet-300">
                        {index + 1}
                      </span>

                      <p className="text-sm leading-6 text-slate-300">
                        {item}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Security and responsibility */}
        <section className="policy-reveal mb-28">
          <SectionHeading
            eyebrow="Trust and limitations"
            title="Know what XOGrid is — and what it isn't."
            description="Clear boundaries matter when working with wallet templates and blockchain transactions."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="policy-card rounded-2xl border border-emerald-500/20 bg-emerald-500/[0.035] p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
                  <CheckCircle2 size={22} />
                </div>

                <h3 className="text-lg font-bold text-white">
                  What XOGrid does
                </h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Provides a registry for wallet templates.",
                  "Generates content-addressed template identifiers.",
                  "Runs supported automated checks.",
                  "Displays community flags and human reviews.",
                  "Helps users inspect and evaluate templates.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-slate-400"
                  >
                    <CheckCircle2
                      size={17}
                      className="mt-0.5 shrink-0 text-emerald-400"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="policy-card rounded-2xl border border-red-500/20 bg-red-500/[0.025] p-6 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-xl bg-red-500/10 p-3 text-red-400">
                  <LockKeyhole size={22} />
                </div>

                <h3 className="text-lg font-bold text-white">
                  What XOGrid does not do
                </h3>
              </div>

              <ul className="space-y-4">
                {[
                  "Does not hold your private keys or funds.",
                  "Does not operate as a wallet or custodian.",
                  "Does not guarantee that templates are safe.",
                  "Does not replace independent security reviews.",
                  "Does not make the final trust decision for you.",
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-3 text-sm leading-6 text-slate-400"
                  >
                    <XCircle
                      size={17}
                      className="mt-0.5 shrink-0 text-red-400"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="policy-reveal mb-20">
          <SectionHeading
            eyebrow="Frequently asked questions"
            title="Still have questions?"
            description="Here are answers to common questions about the XOGrid registry and its evaluation process."
          />

          <div className="mt-10 max-w-4xl space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;

              return (
                <div
                  key={faq.question}
                  className="overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.025] transition-colors duration-300 hover:border-violet-400/20"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? -1 : index)}
                    className="flex w-full items-center justify-between gap-5 p-5 text-left transition-colors hover:bg-white/[0.025] sm:p-6"
                    aria-expanded={isOpen}
                  >
                    <span className="text-sm font-semibold text-white sm:text-base">
                      {faq.question}
                    </span>

                    <ChevronDown
                      size={19}
                      className={`shrink-0 text-slate-400 transition-transform duration-300 ${
                        isOpen ? "rotate-180 text-orange-400" : ""
                      }`}
                    />
                  </button>

                  <div
                    className={`grid transition-all duration-300 ${
                      isOpen
                        ? "grid-rows-[1fr] opacity-100"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-6 text-sm leading-7 text-slate-400 sm:px-6">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="policy-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] px-6 py-12 text-center sm:px-10">
          <div className="absolute left-1/2 top-0 h-40 w-72 -translate-x-1/2 rounded-full bg-orange-500/10 blur-[80px]" />

          <div className="relative z-10">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-orange-500/20 bg-orange-500/10 text-orange-400">
              <ShieldCheck size={27} />
            </div>

            <h2 className="text-2xl font-bold sm:text-3xl">
              Build with transparency.
            </h2>

            <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-400">
              Explore wallet templates, inspect their registry information, and
              make informed decisions with XOGrid.
            </p>

            <Link
              to="/publish"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-orange-500 px-7 py-3.5 text-sm font-bold text-white transition-all hover:bg-orange-600"
            >
              Publish your template
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </div>

      {/* Animation styles */}
      <style>{`
        /* Scroll reveal */
        .policy-reveal {
          opacity: 0;
          transform: translateY(35px);
          transition:
            opacity 0.8s ease,
            transform 0.8s cubic-bezier(0.2, 0.65, 0.3, 1);
        }

        .policy-reveal.policy-visible {
          opacity: 1;
          transform: translateY(0);
        }

        /* Hero entrance */
        @keyframes fadeUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        /* Floating hero card */
        @keyframes heroFloat {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .policy-hero-visual {
          animation: heroFloat 7s ease-in-out infinite;
        }

        /* Background movement */
        @keyframes ambientFloat {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(25px, -20px) scale(1.08);
          }
        }

        @keyframes ambientFloatReverse {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-25px, 20px) scale(1.1);
          }
        }

        .policy-glow {
          animation: ambientFloat 14s ease-in-out infinite;
        }

        .policy-glow-reverse {
          animation: ambientFloatReverse 17s ease-in-out infinite;
        }

        /* Interactive cards */
        .policy-card {
          transition:
            transform 0.35s ease,
            border-color 0.35s ease,
            background-color 0.35s ease,
            box-shadow 0.35s ease;
        }

        @media (hover: hover) and (pointer: fine) {
          .policy-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 16px 40px rgba(139, 92, 246, 0.08);
          }
        }

        /* Mobile optimization */
        @media (max-width: 640px) {
          .policy-reveal {
            transform: translateY(22px);
            transition-duration: 0.65s;
          }

          .policy-hero-visual {
            animation-duration: 9s;
          }

          .policy-card:active {
            transform: scale(0.985);
          }
        }

        /* Accessibility */
        @media (prefers-reduced-motion: reduce) {
          .policy-reveal {
            opacity: 1;
            transform: none;
            transition: none;
          }

          .policy-hero-visual,
          .policy-glow,
          .policy-glow-reverse {
            animation: none !important;
          }

          .policy-card {
            transition: none;
          }
        }
      `}</style>
    </main>
  );
}

export default Policy;
