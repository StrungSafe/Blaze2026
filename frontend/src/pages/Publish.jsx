
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clipboard,
  FileJson,
  Layers3,
  Loader2,
  ShieldAlert,
  UploadCloud,
  X,
  AlertCircle,
  Fingerprint,
  Sparkles,
} from "lucide-react";

import { publishTemplate } from "../api";

const MAX_FILE_SIZE = 256 * 1024;

const publishingSteps = [
  {
    number: "01",
    title: "Validate template",
    description:
      "Your JSON is checked for valid structure before it reaches the registry.",
    icon: CheckCircle2,
  },
  {
    number: "02",
    title: "Generate identity",
    description:
      "XOGrid canonicalizes the template and generates its unique content-based identifier.",
    icon: Fingerprint,
  },
  {
    number: "03",
    title: "Register template",
    description:
      "Your template is registered, or its existing registry entry is returned.",
    icon: Layers3,
  },
];

function Publish() {
  const [jsonText, setJsonText] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const fileInputRef = useRef(null);

  const clearMessages = () => {
    setError("");
    setResult(null);
    setCopied(false);
  };

  const handleTextChange = (event) => {
    setJsonText(event.target.value);
    setFileName("");
    clearMessages();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    clearMessages();

    if (!file.name.toLowerCase().endsWith(".json")) {
      setError("Please select a JSON file.");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Your JSON file exceeds the 256 KB limit.");
      event.target.value = "";
      return;
    }

    try {
      const text = await file.text();
      setJsonText(text);
      setFileName(file.name);
    } catch {
      setError("We couldn't read that file. Please try another JSON file.");
    }

    event.target.value = "";
  };

  const handleRemoveFile = () => {
    setJsonText("");
    setFileName("");
    clearMessages();

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handlePublish = async (event) => {
    event.preventDefault();

    clearMessages();

    if (!jsonText.trim()) {
      setError("Add your template JSON before publishing.");
      return;
    }

    const byteSize = new TextEncoder().encode(jsonText).length;

    if (byteSize > MAX_FILE_SIZE) {
      setError("Your template exceeds the 256 KB limit.");
      return;
    }

    let parsedTemplate;

    try {
      parsedTemplate = JSON.parse(jsonText);
    } catch {
      setError("Invalid JSON. Check your syntax and try again.");
      return;
    }

    if (
      parsedTemplate === null ||
      typeof parsedTemplate !== "object" ||
      Array.isArray(parsedTemplate)
    ) {
      setError("Your template must be a valid JSON object.");
      return;
    }

    setLoading(true);

    try {
      const response = await publishTemplate(parsedTemplate);
      const { data, status } = response;

      if (status !== 200 && status !== 201) {
        throw new Error("The server returned an unexpected response.");
      }

      if (!data?.identifier || typeof data.identifier !== "string") {
        throw new Error(
          "The server did not return a valid template identifier."
        );
      }

      if (typeof data.created !== "boolean") {
        throw new Error(
          "The server response is missing the template creation status."
        );
      }

      setResult({
        identifier: data.identifier,
        created: data.created,
        badge: data.badge || "unchecked",
        status,
      });
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong while publishing. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result?.identifier) return;

    try {
      await navigator.clipboard.writeText(result.identifier);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy the identifier. Please copy it manually.");
    }
  };

  const detailUrl = result
    ? `/t/${encodeURIComponent(result.identifier)}`
    : "";

  return (
    <main className="publish-page relative min-h-screen overflow-hidden bg-[#05070b] px-4 pb-20 pt-28 text-white sm:px-6">
      {/* CLEAN ANIMATED BACKGROUND */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="publish-ambient publish-ambient-one absolute -left-48 -top-40 h-[550px] w-[550px] rounded-full bg-violet-600/[0.13] blur-[150px]" />

        <div className="publish-ambient publish-ambient-two absolute -right-48 top-[420px] h-[500px] w-[500px] rounded-full bg-orange-500/[0.07] blur-[150px]" />

        <div className="absolute -bottom-72 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-violet-600/[0.07] blur-[160px]" />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.2) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
            maskImage: "linear-gradient(to bottom, black, transparent 85%)",
            WebkitMaskImage:
              "linear-gradient(to bottom, black, transparent 85%)",
          }}
        />

        <div className="absolute left-1/2 top-24 h-px w-[70%] -translate-x-1/2 bg-gradient-to-r from-transparent via-violet-400/20 to-transparent" />
      </div>

      {/* PAGE CONTENT */}
      <div className="relative z-10 mx-auto max-w-5xl">
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
        <div className="publish-enter relative mb-12 max-w-2xl">
          <div className="absolute -left-12 -top-16 h-44 w-44 rounded-full bg-violet-500/[0.09] blur-[70px]" />

          <div className="relative">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-400/[0.07] px-3.5 py-2 text-xs font-semibold text-violet-300">
              <Sparkles size={14} />
              XOGrid Registry
              <span className="h-1 w-1 rounded-full bg-orange-400" />
              Open publishing
            </div>

            <h1 className="text-4xl font-bold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              Publish a
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-amber-300 bg-clip-text text-transparent">
                template.
              </span>
            </h1>

            <p className="mt-5 max-w-xl text-sm leading-7 text-white/50 sm:text-base">
              Add your XO wallet template to the registry. Give your template
              a unique identity, make its checks transparent, and share it with
              the XO ecosystem.
            </p>

            <div className="mt-7 flex flex-wrap gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-white/50">
                <Fingerprint size={14} className="text-violet-300" />
                Content-addressed ID
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-xs text-white/50">
                <ShieldAlert size={14} className="text-orange-300" />
                Transparent checks
              </div>
            </div>
          </div>
        </div>

        {/* SUCCESS RESULT */}
        {result ? (
          <section className="publish-panel overflow-hidden rounded-3xl border border-emerald-400/20 bg-white/[0.025] shadow-[0_20px_80px_rgba(0,0,0,0.2)]">
            <div className="border-b border-white/10 p-6 sm:p-8">
              <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-400">
                <CheckCircle2 size={28} />
              </div>

              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-400">
                {result.created
                  ? "Publication successful"
                  : "Template already exists"}
              </p>

              <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                {result.created
                  ? "Your template is registered."
                  : "This template is already registered."}
              </h2>

              <p className="mt-3 max-w-xl text-sm leading-7 text-white/50">
                {result.created
                  ? "The registry has accepted your template and generated its identifier."
                  : "XOGrid found an existing entry for this template. Its existing identifier is shown below."}
              </p>
            </div>

            <div className="p-6 sm:p-8">
              <label className="text-xs font-semibold uppercase tracking-wider text-white/40">
                Server-generated template identifier
              </label>

              <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/30 p-4 sm:flex-row sm:items-center">
                <code className="min-w-0 flex-1 break-all text-sm leading-6 text-violet-300">
                  {result.identifier}
                </code>

                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-2.5 text-sm font-semibold transition duration-300 hover:border-orange-400/40 hover:bg-orange-400/10 hover:text-orange-300"
                >
                  {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  {copied ? "Copied" : "Copy ID"}
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link
                  to={detailUrl}
                  className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-5 py-3 text-sm font-bold text-black transition duration-300 hover:-translate-y-0.5 hover:bg-orange-400"
                >
                  View template
                  <ArrowRight size={16} />
                </Link>

                <button
                  type="button"
                  onClick={() => {
                    setResult(null);
                    setJsonText("");
                    setFileName("");
                    setError("");
                    setCopied(false);
                  }}
                  className="rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-white/70 transition duration-300 hover:border-violet-400/30 hover:bg-violet-400/[0.07] hover:text-white"
                >
                  Publish another
                </button>
              </div>

              <div className="mt-8 flex gap-3 rounded-2xl border border-amber-400/15 bg-amber-400/[0.05] p-4">
                <ShieldAlert
                  size={19}
                  className="mt-0.5 shrink-0 text-amber-300"
                />
                <p className="text-xs leading-6 text-white/50">
                  Registration does not mean this template is safe or
                  independently verified. Review its audit results, flags,
                  and community reviews before relying on it.
                </p>
              </div>
            </div>
          </section>
        ) : (
          <form
            onSubmit={handlePublish}
            className="grid gap-6 lg:grid-cols-[1fr_310px]"
          >
            {/* JSON EDITOR */}
            <section className="publish-panel min-w-0 rounded-3xl border border-white/10 bg-white/[0.025] p-5 shadow-[0_20px_80px_rgba(0,0,0,0.15)] transition duration-500 hover:border-violet-400/20 sm:p-7">
              <div className="mb-7 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold">Template JSON</h2>
                  <p className="mt-1 text-xs text-white/40">
                    Add the template you want to publish.
                  </p>
                </div>

                <span className="rounded-full border border-violet-400/20 bg-violet-400/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-violet-300">
                  JSON
                </span>
              </div>

              {/* Upload area */}
              <div className="mb-6">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileChange}
                  className="hidden"
                  id="template-json-file"
                />

                <label
                  htmlFor="template-json-file"
                  className="group relative flex cursor-pointer flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed border-violet-400/25 bg-violet-400/[0.035] px-5 py-10 text-center transition-all duration-300 hover:border-orange-400/50 hover:bg-orange-400/[0.035]"
                >
                  <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/[0.08] blur-3xl transition duration-500 group-hover:bg-orange-500/[0.10]" />

                  <span className="relative mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-400/10 text-violet-300 transition-all duration-300 group-hover:scale-105 group-hover:border-orange-400/30 group-hover:bg-orange-400/10 group-hover:text-orange-300">
                    <UploadCloud size={24} />
                  </span>

                  <span className="relative text-sm font-semibold text-white/80 transition group-hover:text-orange-300">
                    Click to upload your template
                  </span>

                  <span className="relative mt-2 text-xs text-white/35">
                    Select a JSON file · Maximum 256 KB
                  </span>
                </label>

                {fileName && (
                  <div className="mt-3 flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-3">
                    <FileJson
                      size={18}
                      className="shrink-0 text-violet-300"
                    />

                    <span className="min-w-0 flex-1 truncate text-xs text-white/70">
                      {fileName}
                    </span>

                    <button
                      type="button"
                      onClick={handleRemoveFile}
                      aria-label="Remove selected file"
                      className="rounded-lg p-1.5 text-white/40 transition hover:bg-white/10 hover:text-orange-400"
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}
              </div>

              {/* Editor heading */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <label
                  htmlFor="template-json"
                  className="text-xs font-semibold text-white/60"
                >
                  Or paste JSON here
                </label>

                <span className="text-[11px] tabular-nums text-white/35">
                  {new TextEncoder()
                    .encode(jsonText)
                    .length.toLocaleString()}{" "}
                  / {MAX_FILE_SIZE.toLocaleString()} bytes
                </span>
              </div>

              {/* JSON editor */}
              <div className="relative">
                <div className="absolute left-0 top-0 h-px w-full bg-gradient-to-r from-transparent via-violet-400/40 to-transparent" />

                <textarea
                  id="template-json"
                  value={jsonText}
                  onChange={handleTextChange}
                  spellCheck="false"
                  placeholder={'{\n  "name": "My XO Template",\n  ...\n}'}
                  className="min-h-[340px] w-full resize-y rounded-2xl border border-white/10 bg-[#080a10] p-4 font-mono text-xs leading-6 text-violet-200 outline-none transition duration-300 placeholder:text-white/20 focus:border-orange-400/40 focus:ring-1 focus:ring-orange-400/10 sm:text-sm"
                />
              </div>

              <div className="mt-3 flex items-center justify-between text-[11px] text-white/35">
                <span>Maximum template size: 256 KB</span>
                <span>UTF-8 JSON</span>
              </div>

              {/* Error */}
              {error && (
                <div
                  role="alert"
                  className="mt-5 flex gap-3 rounded-xl border border-red-400/20 bg-red-400/[0.06] p-4 text-sm text-red-300"
                >
                  <AlertCircle size={18} className="mt-0.5 shrink-0" />
                  <span className="leading-6">{error}</span>
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={loading || !jsonText.trim()}
                className="publish-submit group relative mt-7 inline-flex w-full items-center justify-center gap-2 overflow-hidden rounded-xl bg-orange-500 px-6 py-4 text-sm font-bold text-black shadow-[0_8px_30px_rgba(249,115,22,0.12)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-orange-400 hover:shadow-[0_10px_35px_rgba(249,115,22,0.2)] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:translate-y-0"
              >
                <span className="publish-button-shine absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent" />

                <span className="relative inline-flex items-center gap-2">
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Publishing template...
                    </>
                  ) : (
                    <>
                      Publish template
                      <ArrowRight
                        size={17}
                        className="transition-transform duration-300 group-hover:translate-x-1"
                      />
                    </>
                  )}
                </span>
              </button>

              <p className="mt-4 text-center text-[11px] leading-5 text-white/30">
                Your template is processed by the XOGrid registry. Your
                private keys are never requested.
              </p>
            </section>

            {/* PUBLISHING FLOW */}
            <aside className="space-y-5">
              <div className="publish-panel relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025] p-5 transition duration-500 hover:border-violet-400/25 sm:p-6">
                <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/[0.08] blur-3xl" />

                <div className="relative">
                  <div className="mb-7 flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300">
                      <Layers3 size={20} />
                    </div>

                    <div>
                      <h3 className="font-bold">Publishing flow</h3>
                      <p className="mt-1 text-xs text-white/35">
                        Three steps to the registry
                      </p>
                    </div>
                  </div>

                  <div className="relative ml-[13px]">
                    <div className="absolute bottom-8 left-[9px] top-8 w-px bg-gradient-to-b from-violet-400/40 via-white/10 to-orange-400/30" />

                    <div className="space-y-8">
                      {publishingSteps.map((step) => {
                        const StepIcon = step.icon;

                        return (
                          <div
                            key={step.number}
                            className="group relative flex gap-4"
                          >
                            <div className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-[#100e1b] text-violet-300 transition-all duration-300 group-hover:scale-110 group-hover:border-orange-400/60 group-hover:bg-orange-400/10 group-hover:text-orange-400">
                              <StepIcon size={13} />
                            </div>

                            <div className="min-w-0 flex-1 pb-1">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="text-[10px] font-bold tracking-[0.15em] text-orange-400">
                                  {step.number}
                                </span>

                                <span className="h-px w-5 bg-white/10 transition-colors group-hover:bg-orange-400/40" />
                              </div>

                              <h4 className="text-sm font-semibold text-white/85 transition-colors duration-300 group-hover:text-orange-300">
                                {step.title}
                              </h4>

                              <p className="mt-2 text-xs leading-6 text-white/40">
                                {step.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Registry identity card */}
              <div className="group relative overflow-hidden rounded-3xl border border-violet-400/15 bg-violet-400/[0.035] p-5 transition-all duration-300 hover:border-violet-400/30">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-violet-500/[0.09] blur-3xl transition duration-500 group-hover:bg-orange-500/[0.08]" />

                <div className="relative">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl border border-violet-400/20 bg-violet-400/10 text-violet-300 transition duration-300 group-hover:rotate-6 group-hover:text-orange-300">
                    <Fingerprint size={19} />
                  </div>

                  <h3 className="text-sm font-bold">
                    Every template has an identity.
                  </h3>

                  <p className="mt-2 text-xs leading-6 text-white/45">
                    XOGrid generates a content-addressed identifier from the
                    canonical template. If the template changes, its identity
                    changes too.
                  </p>
                </div>
              </div>

              {/* Important notice */}
              <div className="relative overflow-hidden rounded-3xl border border-amber-400/15 bg-amber-400/[0.035] p-5">
                <div className="absolute -right-12 -top-12 h-32 w-32 rounded-full bg-amber-400/[0.07] blur-3xl" />

                <div className="relative">
                  <div className="flex items-center gap-2 text-amber-300">
                    <ShieldAlert size={17} />
                    <h3 className="text-sm font-bold">Important</h3>
                  </div>

                  <p className="mt-3 text-xs leading-6 text-white/50">
                    Publishing does not certify a template as safe. Automated
                    checks and community reviews are separate registry
                    features. Always inspect the available information before
                    using a template.
                  </p>
                </div>
              </div>
            </aside>
          </form>
        )}
      </div>

      {/* SUBTLE ANIMATIONS */}
      <style>{`
        .publish-page {
          isolation: isolate;
        }

        .publish-ambient {
          will-change: transform;
        }

        .publish-ambient-one {
          animation: ambientFloatOne 18s ease-in-out infinite alternate;
        }

        .publish-ambient-two {
          animation: ambientFloatTwo 22s ease-in-out infinite alternate;
        }

        .publish-enter {
          animation: publishFadeUp 0.7s ease-out both;
        }

        .publish-panel {
          animation: publishFadeUp 0.8s ease-out both;
        }

        .publish-panel:nth-child(2) {
          animation-delay: 0.12s;
        }

        .publish-submit:not(:disabled):hover .publish-button-shine {
          animation: buttonShine 0.8s ease;
        }

        @keyframes ambientFloatOne {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(35px, 25px, 0);
          }
        }

        @keyframes ambientFloatTwo {
          from {
            transform: translate3d(0, 0, 0);
          }
          to {
            transform: translate3d(-30px, 35px, 0);
          }
        }

        @keyframes publishFadeUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes buttonShine {
          from {
            transform: translateX(-100%);
          }
          to {
            transform: translateX(100%);
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .publish-ambient,
          .publish-enter,
          .publish-panel,
          .publish-button-shine {
            animation: none !important;
          }

          .publish-panel,
          .publish-enter {
            opacity: 1;
            transform: none;
          }
        }
      `}</style>
    </main>
  );
}

export default Publish;
