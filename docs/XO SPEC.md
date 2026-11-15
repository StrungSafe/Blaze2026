# Build spec: XOGrid

Audience: Miguel and Nathaniel, and any coding assistant given this file. Companion to `docs/SCOPE.md` (scope and tracks). If the two disagree, SCOPE.md wins until we edit one of them.

Items marked **[UNVERIFIED]** have not been run. Do not build on them without a spike.

## 1. What we are building
A registry for XO wallet templates ("Docker Hub for templates"). Anyone can publish a template. XOGrid gives it a content-addressed ID, runs automated checks, shows community flags and human reviews, and previews how a wallet trust policy would treat it. A demo flow sends a real BCH mainnet transaction using a template from the hub.

Non-goals: holding user keys or funds, acting as a wallet, claiming a template is "safe", a login system for publishers, publisher reputation scores (deferred).

## 2. Pinned versions (do not upgrade mid-build)
- `@xo-cash/engine@0.1.1-next.17778370827` (released 2026-11-05; npm `latest` is stale, always use the `next` tag)
- `@xo-cash/utils@0.0.11`, `@xo-cash/templates@0.0.12`, `@xo-cash/state@0.0.5`
- `@bitauth/libauth@3.1.0-next.8`
- Node 22, yarn, TypeScript, React, Tailwind, SQLite
- The XO team posts engine updates in the BLAZE Telegram. Check there before bumping the engine.

## 3. Architecture
One Node + TypeScript app, one Docker image.
- Backend: HTTP API plus static file serving of the built React frontend. No separate reverse proxy.
- Frontend: React + Tailwind, built to static files at image build time.
- Database: SQLite file on a mounted volume for now, PostgreSQL later if we grow (agreed in PR review). Use a query builder with migrations (for example Drizzle or Kysely) and avoid SQLite-only SQL, so the move is a configuration change. A CLI initialises and seeds it.
- The server never touches private keys. Mainnet transactions are signed by the user's wallet or by the engine running in the user's browser **[PARTLY VERIFIED: template validation, offline script compile and `InvitationBuilder` run in headless Chromium when bundled with esbuild, with `node:path` stubbed (it is imported by `@electrum-cash/application`). NOT verified: `Engine.create` with Electrum connections and IndexedDB storage, because the test environment had no network. Use a bundler alias or shim for `node:path` (Vite needs the same).]**. If the engine cannot run in a browser, fall back to a documented flow that uses the Blaze Tool (`blaze.xo.cash`) for signing and show the resulting txid in the hub.

Suggested layout:
```
/server   src/index.ts  src/db.ts  src/audit/*.ts  src/routes/*.ts  src/cli.ts
/web      src/pages/*  src/components/*
/seed     templates seeded at init (from @xo-cash/templates plus our own)
Dockerfile  docker-compose.yml  README.md
```

## 4. Data model (SQLite)
- `templates(identifier TEXT PRIMARY KEY, name, description, json TEXT, publisher TEXT, created_at, removed INTEGER DEFAULT 0, removed_reason)`
- `audit_reports(id, identifier, checker_version, results_json, created_at)`
- `flags(id, identifier, reason, reporter, status, created_at)` (`status`: open, dismissed, upheld)
- `reviews(id, identifier, reviewer_address, signature, note, created_at)` (human sign-off for exactly this identifier, signed by the reviewer's key)
- `admins(address_or_pubkey PRIMARY KEY, label, added_at)` (allowlist of moderator identities)
- `spotlight(identifier PRIMARY KEY, blurb, position, added_at)` (templates featured on Home)
- `moderation_log(id, actor, action, identifier, note, created_at)`

`identifier` is `generateTemplateIdentifier(parseTemplate(input))`. **Always canonicalise with `parseTemplate` before hashing.** Verified: hashing a raw object (for example the P2PKH sample) gives a different ID than hashing the parsed form (`6b14f773...` versus `a31eb858...`), because `parseTemplate` reorders keys into schema order (same length, same content). After one `parseTemplate` pass the ID is stable across repeated `serializeTemplate` and `parseTemplate` round-trips, for all five shipped templates. Store and serve the canonical `serializeTemplate` output. The server recomputes the identifier on every publish and never trusts a client-supplied one. Publishing the same JSON twice returns the existing row.

## 5. Badges (derived, never stored as a free-text claim)
- **Unchecked**: no audit report yet.
- **Auto-checked**: latest report has no `fail` results. Does not mean safe.
- **Reviewed**: at least one review row for this exact identifier. Shows reviewer name and date.
- **Flagged**: at least one open flag. Shown in addition to any badge, never hiding it.
- **Removed**: moderator removed it. Show a tombstone with the reason. Do not delete rows.
A changed template has a new identifier, so it starts at Unchecked.

## 5b. On-chain moderator identity (phase 2)
Per the PR review: server operations are authorised by signatures from a known pubkey or xpub, and on-chain operations use a CashToken category from which we mint each moderator a token.
- Phase 1: signed-challenge login against the `admins` allowlist (section 7). Enough for the demo.
- Phase 2: create a "XOGrid Reviewer" CashToken category (genesis from a vout-0 UTXO), mint one token per moderator, and require the reviewer's address to hold one for the "Reviewed" action. Rehearse on chipnet, then mainnet. This is also a legitimate mainnet transaction for the track requirement and a good place for Nathaniel to apply the token practice from the starter guide. **[UNVERIFIED: how the server checks token holdings (an Electrum query through mainnet-js is the likely route); spike before committing.]**
- Keep Phase 2 off the two-minute demo path. It is not needed for the judge walk-through.

## 6. Audit checks (v1, `checker_version = "1"`)
Each check returns `pass`, `warn`, `fail` or `skipped` with a one-line message.
1. **Schema**: `parseTemplate(json)` from `@xo-cash/utils`. Verified offline: accepts the sample templates, rejects a template with `actions` removed.
2. **ID**: re-parse the stored JSON with `parseTemplate`, recompute `generateTemplateIdentifier`, and compare with the stored identifier. Also `warn` if the submitted JSON was not already in canonical key order (its raw hash differs), so publishers know their file hashes differently when fed to other tools.
3. **Size**: reject above 256 KB. The P2PKH sample is about 28 KB.
4. **References**: every role, action, script, variable, constant and locking script mentioned must exist. Write this ourselves (no library function). Fail on dangling references.
5. **Compile**: for each locking script, call `compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, id, vars)` with generated sample variable values. Verified for the faucet template. Scripts that need key data return an error ("keys property was not provided"). Report those as `skipped`, not `fail`. `buildCompilerBytecodeDataFromCompilationVariables` is exported by the engine and may supply keys **[UNVERIFIED]**.
6. **Scenarios**: `warn` if the template has no `scenarios` (only the P2PKH sample ships one). XO's blog says scenarios "are not suitable for providing trust", so a present scenario is informational only.
7. **Invitation validation** (optional): `validateInvitation` and `listInvitationValidationIssues` on a stored sample invitation **[UNVERIFIED]**.
Heuristic covenant hints (persist, token category preserved, value conserved) are a stretch item. If added, label them "heuristic".

## 7. API (JSON)
- `GET /api/templates?query=&badge=&sort=&page=` list and search with badge summary (`sort`: newest, name, most flagged)
- `GET /api/templates/:identifier` full detail: JSON, latest audit, flags, reviews
- `POST /api/templates` publish (validate, hash, store, run audit)
- `POST /api/templates/:identifier/flags` body `{reason, reporter}`
- `POST /api/policy/evaluate` body `{policy, identifier}` returns `{decision, reasons}`
- `GET /api/spotlight` featured templates for Home
- Admin auth (replaces the shared token, per review): `POST /api/admin/challenge` returns a one-time nonce; `POST /api/admin/login` takes `{address, signature}`, verifies the signature of the nonce against the `admins` allowlist and returns a short-lived session. Each moderator has their own key, so every action is attributable. Seed the allowlist from the `ADMIN_ADDRESSES` environment variable (comma-separated pubkeys or addresses). **[UNVERIFIED: message signing and verification with libauth or mainnet-js; spike it first.]**
- Admin (session required): `GET /api/admin/summary`, `GET /api/admin/flags`, `POST /api/admin/flags/:id/resolve`, `POST /api/admin/templates/:identifier/review`, `POST /api/admin/templates/:identifier/remove`, `PUT /api/admin/spotlight`
Rate limit publish and flag routes. Treat all template content as untrusted data.

## 8. Pages
1. **Home**: top banner (see section 10), a spotlight of featured templates (admin-chosen, with a one-line blurb), a link to Browse, and one clear "Try the demo" button.
1b. **Browse / search**: list of all templates with search box, badge filter, sort and paging; each row shows badge and flag count. This is how users reach a detail page beyond the spotlight.
2. **Template detail**: name, identifier (copyable), badges, audit results as a plain pass/warn/fail list, flags, reviews, a small "what this template does" view built from its actions and roles, the policy decision, "Run demo" when a demo exists.
3. **Publish**: paste or upload JSON, show validation errors in plain words.
4. **Policy**: edit a simple policy JSON (`minBadge`, `blockFlagged`, `allowIdentifiers`) and see allow or block per template.
5. **Admin**: summary counts, flag queue, review and remove actions.
Render template text as plain text, never as HTML.

## 9. Demo flow (acceptance test)
A stranger reaches a confirmed mainnet transaction in about two minutes:
1. Home, pick a seeded template.
2. See its audit result and policy decision.
3. Click "Run demo". An invitation is created and executed.
4. Show the txid with a block explorer link.
The mainnet step must use minimal funds and be recoverable (XO team guidance): for example, funds returned to the sender. Rehearse on chipnet first (faucets: `https://tbch.googol.cash/`, `https://chipnet.bch.ninja/`). The invitation used must be inspectable in the debug tool and be submitted with the bounty entry.

## 10. Required banner (every page, top)
- Link to our Widget Factory slides (URL to be added)
- Link to the GitHub repo `github.com/XOGrid-Cash/Blaze2026_XOGrid`
- CashTokens address for EMBER2026 donations (address to be added; must be a token-aware address)

## 11. Docker
- Multi-stage `Dockerfile`: build web, build server, run as non-root.
- `docker-compose.yml` with a volume for the SQLite file and env vars `PORT`, `ADMIN_ADDRESSES`, `DATABASE_PATH`.
- Container start runs the CLI `init` command if the database is missing, then starts the server.
- README with exact `docker compose up` instructions.
- Hosting: Miguel's subdomain with HTTPS. Must stay up through judging (Nov 23 to 27).

## 12. Seed data
Seed the sample templates exported by `@xo-cash/templates` (p2pkh, faucet, multisig, wrapped BCH; check `source/index.ts` exports for exact names) plus our own novel template(s). Start with one simple template that returns funds to the sender, then grow. Mark seeded ones Unchecked until the audit runs at init.

## 13. Copy rules
- Badges say what was checked. Never write "safe", "secure" or "verified safe".
- "Reviewed" always shows the reviewer's name and the identifier it applies to.
- Flags are always visible. Removal leaves a tombstone.

## 14. Milestones
- **Sat Nov 8 (gate), status Nov 9:** template round-trip PASSED (canonical IDs stable). Browser run of validation, compile and invitation building PASSED in headless Chromium with a `node:path` stub. STILL OPEN (needs network, must be run by Miguel or Nathaniel): `Engine.create` on chipnet in a real browser, opening an engine-created invitation in the Blaze Tool (`blaze.xo.cash`), and a path to a mainnet tx from the hosted page. If `Engine.create` fails in the browser, switch to the Blaze Tool fallback in section 3.
- **Nov 12:** registry, audit v1, publish page, demo on chipnet, Docker image runs.
- **Nov 13:** registration closes on DoraHacks.
- **Nov 18:** flags, badges, policy preview, admin portal.
- **Nov 20:** mainnet demo tx done, slides and banner complete, XO feedback written personally by us (required, about 500 words, AI-written feedback is rejected).
- **Nov 22 15:00 (UTC+1):** submit.

## 15. Decisions and open items
Decided in PR review:
- Database: SQLite now, PostgreSQL later (section 2).
- Admin identity: per-moderator keys and signatures, not a shared token (sections 5b and 7).
- Pages: add Browse/search and a Home spotlight (section 8).

Still open:
1. Which seeded or novel template backs the demo transaction.
2. Whether the moderator token (phase 2) is in scope or a stretch.
3. The EMBER2026 address and slides URL for the banner.
4. Who spikes message signing and token-holding checks, and by when.