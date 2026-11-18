# Handoff: XOGrid (formerly XO Template Hub; as of 2026-11-15)

## Layout
- `server/`  Fastify + Kysely/SQLite API, audit checks, admin API. `npm test` (79 tests).
- `web/`     React + Vite + Tailwind frontend. `npm run build`; dev: `npm run dev` (proxies /api to :3000).
- `probe/`   Standalone page to test Selene login signing. See `probe/README.md`.
- `Dockerfile` (repo root, UNTESTED), one container serves API + built web app.

## Run locally
1. `cd server && npm install && npm run cli -- seed`
2. `cd web && npm install --legacy-peer-deps && npm run build`
3. `cd server && ADMIN_IDENTITIES="you=<pubkey|address|xpub>" npm run dev`  then open http://localhost:3000

## Done and tested
Registry, audit checks, flags, reviews, policy preview, admin API, UI (Home, Browse, Template, Admin) driven end to end in a real browser against the live API.

## Added 2026-11-11
- `GET /api/templates/:id/raw` (verifiable, immutable, 410 when removed), read-only CORS, `admin-add|admin-list|admin-remove` CLI.

## Verified 2026-11-11 (sandbox with no registry/chipnet access)
- Dockerfile logic: clean-room replay of every build step (npm install, web build, server tsc, prune) plus the final stage
  built and run as a real container on a stand-in base image: non-root user, /data volume, restart keeps data. Not
  verified: pulling node:22-slim and the apt-get step (no registry access here).
- First start seeds the 5 sample templates when the database is empty (SEED_ON_EMPTY=0 disables).
- yarn classic (1.22) install, test, typecheck and build all pass; server needs `vite` declared explicitly for vitest.
- Selene signs the login challenge; Admin page login works end to end.

## Added 2026-11-14: Claim-Code Voucher (our novel template)
- `server/src/templates/claim-voucher.ts`: P2SH32 hash lock, `OP_SHA256 <codeHash> OP_EQUAL`; actions createVoucher / claimVoucher. Seeded as the 6th hub template (publisher "XO Template Hub").
- Verified offline in the BCH 2026 VM: right code accepted; wrong code, empty code and the hash itself rejected. Script mutations are caught by tests.
- HAZARD: bytes variables must be passed as HEX text. Raw Uint8Array compiles to a different lock script and strands funds.
- Blaze Tool opens our chipnet invitation cleanly once the tool's wallet is switched to chipnet.
- `server/scripts/chipnet-voucher.ts issue | claim <code>` has NOT been run yet. Unknowns: whether the engine tracks the voucher output (role on the output), and whether a claim with zero template outputs plus change builds.

## Not done / unverified
- Demo page is a stub. Needs the mainnet BCH transaction (recoverable, minimal funds; chipnet first).
- Selene signing the login challenge: run the probe. Until it passes, admin login by wallet is unproven.
- `Engine.create` in a browser, an invitation in the Blaze Tool, Docker build, yarn install.
- Banner: slides URL and EMBER2026 CashTokens address are placeholders (VITE_SLIDES_URL, VITE_EMBER_ADDRESS).
- Moderator spotlight editing UI is minimal ("Feature only this").
- Coordinate with Miguel on whose backend is used.


## 2026-11-15
- Project renamed to **XOGrid** everywhere (UI, login challenge text, package names, Dockerfile, seed publisher). The only remaining old-name string is inside `server/test/fixtures/signed-message-vectors.json`, a signed test vector that must not be edited.
- New working repo: github.com/XOGrid-Cash/Blaze2026_XOGrid (fork of StrungSafe/Blaze2026). The code was brought in as stages pushed to main on 2026-11-15 (docs, server, engine scripts and probe, web app, Demo page, reviews, docs and Docker).
- Hackathon rule (user's reading): ideation before Nov 14, the majority of the work after it. The hub server, admin login and web app were prototyped before Nov 14. Do not present them as written inside the window; the README must say so and the remaining work (Demo page, voucher flow, mainnet transaction, polish) happens in the new repo.
- Chipnet voucher cycle verified: issue tx d21098db7a99f59a215adecf78d8413eac943235b8bf48678c544eaad3b80cd1, claim tx 31375029f898ffba7867122c2e4f1ce6346017420e1911d614a7775511432dad. Both invitations are Completed in the Blaze Tool (chipnet), template imported from `claim-voucher-template.json`.
- Engine lessons: (1) the Electrum cache is a process-wide singleton, so start-up retry must re-run the whole process (`scripts/_engine.ts`); (2) `executeAction` broadcasts first and then releases coin reservations, which can throw `UnspentOutputNotFoundInStoreError` after a successful broadcast, so `chipnet-voucher.ts` reads the hash from the stored invitation; (3) the claim code is saved to `.xo-demo/voucher-code.txt` before broadcasting.
- Tests: 79 passing.

### Later on 2026-11-15
- New engine 0.1.1-next.18029697917 verified: 102 tests passed, a second chipnet voucher pair (a0c6bae7... / 2caca1f2...) completed in the Blaze Tool.
- Added wallet-signed community reviews (rating 1-5, text 3-1000, one per wallet per template, nonce single-use, 5 minute challenge). Files: server/src/user-reviews.ts, db.ts (user_reviews table), app.ts routes, admin-routes.ts hide/unhide, registry.ts (userReviewCount, averageRating, sort=rating).
- Added server/src/describe.ts and `plainEnglish` on template detail.
- Message-proof caveat: a message signature over different text recovers an unrelated key (no error). Safe, since a signer can only ever publish under a key they hold, but it is why the UI should prefer transaction proofs.
- Tests: 120 passing (8 files).
- Stretch goal, not built: let people create XO templates from scratch in plain English, no code. Idea: a guided form that fills a small set of patterns (payment, escrow, voucher, split) and emits a template that must pass the same six audit checks before it can be published.
- Pending: push staged PRs once Miguel grants write access; frontend dev builds the review UI against docs/FRONTEND.md; Miguel's templates to integrate; mainnet Demo-page run; real docker build.

### Repo state after the stages (2026-11-15)
- `main` of XOGrid-Cash/Blaze2026_XOGrid holds: server/ (registry, audit, admin login, reviews), probe/, web/ (our React and TypeScript app), docs/.
- John (frontend dev) pushed a landing page in `frontend/` (React JSX, Vite). It is separate from `web/`. Open decision for John and Nathaniel: which UI is the real one, or how the landing page and `web/` pages are combined. `docs/FRONTEND.md` is the API contract either way. The Dockerfile at the repo root builds `web/`; point it at `frontend/` if that becomes the main UI.
- `server/Dockerfile` (from the earlier snapshot Miguel merged) and the root `Dockerfile` both exist. The root one builds server and web together. Neither is tested with a real `docker build` yet.

### Mainnet proof (2026-11-16)
- Demo page, Selene over WizardConnect, mainnet, Claim-Code Voucher template 317c4947b5b9cc71d1fe01616cdc930b6ca3ef5808700c68d1cb0696e79b4911.
- Issue: d77b111e4db749c177cc62d2524c0dd89b0b2ca8b2df57039e2b21e7b68c73e1 (1,000 sat voucher, fee 400).
- Claim: b669d2b9ecb035fe3ee63613efdc6cf51cdf7e4112c52c16d2043a8d30fea919 (750 sat out, fee 250).
- The voucher output address derived from the claim code matches the issue transaction's output.


## 2026-11-18: shared wallet and banner
- Real UI is `frontend/` (React, Vite, Tailwind). `web/` is a backend test stub, to be mined and then deleted.
- One site-wide wallet connection: `frontend/src/hub/WalletContext.tsx` (`useWallet()`), mounted in `App.tsx` with a single
  `ConnectWalletModal`. Navbar, Admin sign-in, ReviewForm and Demo all use it. The Demo adopts the shared session
  (`WizardConnectWallet.adopt`). WalletConnect was dropped from the modal. The connection is in memory; a reload ends it.
  The navbar and the DashboardLayout header show the wallet's shortened receive address (not the wallet name).
- Fixed top elements use `top: var(--banner-offset, 0px)` so the banner never covers them (navbar, DashboardLayout sidebar,
  Docs sidebar). Admin no longer draws its own header: it renders inside DashboardLayout.
- Required top banner: `components/TopBanner.tsx` + `config/banner.ts`. EMBER2026 address is set (token-aware, checksum
  verified); `VITE_SLIDES_URL` is still unset and the banner says "Slides: link coming soon".
- Verified: `tsc --noEmit` and `npm run build` pass; banner, navbar offset, connect modal and Admin connect button checked in
  a real browser at desktop and 375px width. NOT verified: a live Selene connection through the new modal, Admin login,
  a review signed through it, and the Demo adopting the shared session (the sandbox blocks the WizardConnect relay).
  Test each with a real wallet before relying on it.
- Still open: Dashboard shows mock data; delete `web/` after mining; slides URL;
  set `ADMIN_IDENTITIES` on Render (yours, Miguel's, John's); README/docs now point at `frontend/`.

## Hosted deployment (Postgres)

The server now supports PostgreSQL. With `DATABASE_URL` set (Supabase Session pooler string) all data lives there; without
it the server uses SQLite exactly as before. The whole test suite passes on both (`npm test`, and
`TEST_DATABASE_URL=... npm run test:postgres`). `/api/health` now touches the database so an uptime pinger keeps a free
host and a free database awake. The hosting plan and Miguel's setup steps are in `docs/DEPLOY.md`.
