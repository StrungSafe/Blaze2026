# Build spec: XO Template Hub

Audience: Miguel and Nathaniel, and any coding assistant given this file. Companion to `docs/SCOPE.md` (scope and tracks). If the two disagree, SCOPE.md wins until we edit one of them.

Items marked **[UNVERIFIED]** have not been run. Do not build on them without a spike.

## 1. What we are building

A registry for XO wallet templates ("Docker Hub for templates"). Anyone can publish a template. The hub gives it a content-addressed ID, runs automated checks, shows community flags and human reviews, and previews how a wallet trust policy would treat it. A demo flow sends a real BCH mainnet transaction using a template from the hub.

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
- Database: SQLite file on a mounted volume. A CLI initialises and seeds it.
- The server never touches private keys. Mainnet transactions are signed by the user's wallet or by the engine running in the user's browser **[UNVERIFIED: engine in browser]**. If the engine cannot run in a browser, fall back to a documented flow that uses the Blaze Tool (`blaze.xo.cash`) for signing and show the resulting txid in the hub.

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
- `reviews(id, identifier, reviewer, note, created_at)` (human sign-off for exactly this identifier)
- `moderation_log(id, actor, action, identifier, note, created_at)`

`identifier` is the value from `generateTemplateIdentifier(template)`. It is recomputed by the server on every publish. Never trust a client-supplied identifier. Publishing the same JSON twice returns the existing row.

## 5. Badges (derived, never stored as a free-text claim)

- **Unchecked**: no audit report yet.
- **Auto-checked**: latest report has no `fail` results. Does not mean safe.
- **Reviewed**: at least one review row for this exact identifier. Shows reviewer name and date. (*Reviewers have to take a test to become a reviewer or it can just be us and the XO team devs for now)*
- **Flagged**: at least one open flag. Shown in addition to any badge, never hiding it.
- **Removed**: moderator removed it. Show a tombstone with the reason. Do not delete rows.
  A changed template has a new identifier, so it starts at Unchecked.

## 6. Audit checks (v1, `checker_version = "1"`)

Each check returns `pass`, `warn`, `fail` or `skipped` with a one-line message.

1. **Schema**: `parseTemplate(json)` from `@xo-cash/utils`. Verified offline: accepts the sample templates, rejects a template with `actions` removed.
2. **ID**: recompute `generateTemplateIdentifier` and compare with the stored one.
3. **Size**: reject above 256 KB. The P2PKH sample is about 28 KB.
4. **References**: every role, action, script, variable, constant and locking script mentioned must exist. Write this ourselves (no library function). Fail on dangling references.
5. **Compile**: for each locking script, call `compileLockingBytecodeFromTemplateLockingScriptIdentifier(template, id, vars)` with generated sample variable values. Verified for the faucet template. Scripts that need key data return an error ("keys property was not provided"). Report those as `skipped`, not `fail`. `buildCompilerBytecodeDataFromCompilationVariables` is exported by the engine and may supply keys **[UNVERIFIED]**.
6. **Scenarios**: `warn` if the template has no `scenarios` (only the P2PKH sample ships one). XO's blog says scenarios "are not suitable for providing trust", so a present scenario is informational only.
7. **Invitation validation** (optional): `validateInvitation` and `listInvitationValidationIssues` on a stored sample invitation **[UNVERIFIED]**.
   Heuristic covenant hints (persist, token category preserved, value conserved) are a stretch item. If added, label them "heuristic".

## 7. API (JSON)

- `GET /api/templates?query=&badge=` list with badge summary
- `GET /api/templates/:identifier` full detail: JSON, latest audit, flags, reviews
- `POST /api/templates` publish (validate, hash, store, run audit)
- `POST /api/templates/:identifier/flags` body `{reason, reporter}`
- `POST /api/policy/evaluate` body `{policy, identifier}` returns `{decision, reasons}`
- Admin (header `Authorization: Bearer ${ADMIN_TOKEN}`): `GET /api/admin/summary`, `GET /api/admin/flags`, `POST /api/admin/flags/:id/resolve`, `POST /api/admin/templates/:identifier/review`, `POST /api/admin/templates/:identifier/remove`
  Rate limit publish and flag routes. Treat all template content as untrusted data.

## 8. Pages

1. **Home**: top banner (see section 10), short list of templates with badges and flag counts, one clear "Try the demo" button.
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
- Link to the GitHub repo `github.com/StrungSafe/Blaze2026`
- CashTokens address for EMBER2026 donations (address to be added; must be a token-aware address)

## 11. Docker

- Multi-stage `Dockerfile`: build web, build server, run as non-root.
- `docker-compose.yml` with a volume for the SQLite file and env vars `PORT`, `ADMIN_TOKEN`, `DATABASE_PATH`.
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

- **Sat Nov 8 (gate):** engine invitation opens in the Blaze Tool on chipnet, template round-trip works in the app, path to a mainnet tx from the hosted page exists. If the browser engine fails, switch to the Blaze Tool fallback in section 3.
- **Nov 12:** registry, audit v1, publish page, demo on chipnet, Docker image runs.
- **Nov 13:** registration closes on DoraHacks.
- **Nov 18:** flags, badges, policy preview, admin portal.
- **Nov 20:** mainnet demo tx done, slides and banner complete, XO feedback written personally by us (required, about 500 words, AI-written feedback is rejected).
- **Nov 22 15:00 (UTC+1):** submit.

## 15. Open items to decide

1. Confirm SQLite as the database to make things easier, you mentioned MSSQL but i believe as we grow we can move to PostgreeSQL.
2. Which seeded or novel template backs the demo transaction.
3. Admin token handling (should we single shared token or multiple).
4. The EMBER2026 address and slides URL for the banner.
