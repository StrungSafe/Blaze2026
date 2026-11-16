# XOGrid frontend guide

For the frontend developer. The backend is a Fastify server that exposes a JSON API and also serves the built web app, so one process runs everything. This guide lists what the UI can rely on.

## Run it

    cd server && npm install && npm run dev     # API + static files on http://localhost:3000
    cd web && npm install --legacy-peer-deps && npm run dev   # Vite dev server, proxies /api to :3000
    cd web && npm run build                      # writes web/dist, which the server serves

In production the server serves `web/dist` (set `WEB_DIR`, default `../web/dist`), with `index.html` as the fallback for every non-API GET, so client-side routes such as `/demo` and `/t/<id>` work on reload.

Stack: React 18, react-router 6, Tailwind 4, Vite 6, TypeScript. `web/src/api.ts` holds the shared API types and the `api()` fetch helper.

## Banner values

The top banner reads `VITE_SLIDES_URL`, `VITE_EMBER_ADDRESS` and `VITE_REPO_URL` from `web/.env` at build time. Set them and rebuild.

## Public API (no login)

All responses are JSON. Errors are `{ "error": "message" }` with a 4xx status. Public GET routes send `access-control-allow-origin: *`.

| Method and path | What it does |
|---|---|
| `GET /api/health` | `{ ok: true }` |
| `GET /api/templates` | List. Query: `query` (text, max 100), `badge` (`unchecked`, `auto-checked`, `reviewed`), `sort` (`newest`, `name`, `flagged`, `rating`), `page` (from 1), `pageSize` (1 to 50, default 12). Returns `{ items: Summary[], total, page, pageSize }` |
| `GET /api/templates/:identifier` | Detail: the `Summary` fields plus `template`, `auditReport`, `actions`, `roles`, `flags`, `reviews`. 404 if unknown |
| `GET /api/templates/:identifier/raw` | The template exactly as an XO tool expects it, immutable and cacheable. 404 unknown, 410 removed |
| `POST /api/templates` | Publish. Body `{ template, publisher? }`. 201 if new, 200 if it already existed. Returns `{ identifier, created, badge }`. 400 invalid template, 413 over 256 KB. Rate limited to 10 per minute |
| `POST /api/templates/:identifier/flags` | Report a template. Body `{ reason, reporter? }`. 201. Rate limited to 20 per minute |
| `GET /api/spotlight` | `{ items }`, the featured templates for the Home page |
| `POST /api/policy/evaluate` | Body `{ policy, identifier }`. Returns `{ decision: 'allow' \| 'block', reasons: string[] }`. Policy fields: `minBadge`, `blockFlagged`, `allowIdentifiers`, `blockIdentifiers` |

The TypeScript shapes (`Summary`, `Detail`, `CheckResult`, `Decision`) are in `web/src/api.ts`; keep that file in step with the server.

### Community reviews (wallet-signed)

Any wallet can review a template. A review is a rating (whole number 1 to 5) and text (3 to 1000 characters). One review per wallet per template. Every summary and detail now carries `userReviewCount` and `averageRating` (null when unrated). Detail also carries `plainEnglish`: `{ summary, steps[], whoDoesWhat[], youWillNeed[] }`, generated from the template itself. Show it above the raw template.

| Call | What it does |
| --- | --- |
| `GET /api/templates/:id/reviews?page&pageSize` | `{ items: [{ id, reviewerAddress, reviewer (shortened), rating, body, createdAt }], total, page, pageSize, stats: { count, average, distribution } }` |
| `POST /api/templates/:id/reviews/challenge` body `{ rating, body, publicKey? }` | Stores the review on the server and returns `{ nonce, expiresAt, message, review, walletSignRequest? }`. `walletSignRequest` is present when `publicKey` (compressed, hex) was sent |
| `POST /api/templates/:id/reviews` body `{ nonce, proof }` | `proof` is `{ type: 'transaction', signedTransaction }` or `{ type: 'message', signature }`. Publishes exactly the stored review. 201 `{ id, reviewerAddress, rating, body }` |

Flow: collect rating and text, send the challenge call with the wallet's public key, ask the wallet to sign `walletSignRequest` (same `signTransaction` path as admin login, `broadcast: false`), then post the proof. The text cannot change after the challenge. Errors: 400 bad input, 401 proof failed (start again, the nonce is single-use and lasts 5 minutes), 404 unknown template, 409 already reviewed or template removed.

Limits to be honest about in the UI copy: a review proves a wallet signed it, not that the person used the template. Anyone can make a new wallet. Moderators can hide a review (`GET /api/admin/user-reviews`, `POST /api/admin/user-reviews/:id/hide` with `{ reason }`, `POST .../unhide`). Moderator reviews (the `reviews` array and the `reviewed` badge) are separate from community reviews.

### Identifiers and badges

- A template identifier is a SHA-256 based hash of the template content, so it never changes for the same template and is safe to use in URLs.
- Badges: `unchecked` (no checks recorded), `auto-checked` (the automated checks found no failure, which is never a safety claim) and `reviewed` (a moderator reviewed this exact template). Always show the tooltip text for them; `web/src/components.tsx` has it.
- A removed template has `removed: true` and a `removedReason`. Do not link to its raw JSON.

## Moderator API (login required)

Login proves control of an allowlisted moderator key by signing a challenge with a WizardConnect wallet. There are no passwords.

1. `POST /api/admin/challenge` returns `{ nonce, expiresAt, message }` (valid for 5 minutes, single use).
2. The wallet signs. The UI builds the request with `buildWalletSignRequest(nonce, publicKey)` from `server/src/auth/challenge-transaction.ts` (see `web/src/wallet.ts`) and calls the wallet with `broadcast: false`. Nothing is ever broadcast.
3. `POST /api/admin/login` with `{ nonce, proof }` where `proof` is `{ type: 'transaction', signedTransaction }` or `{ type: 'message', signature }`. Returns `{ token, admin, expiresAt }`. A failure is always a generic 401 `Login failed.`; the real reason is only in the server log.
4. Send `Authorization: Bearer <token>` on every call below. Sessions last 1 hour. A 401 means log in again.

| Method and path | Body or query | Notes |
|---|---|---|
| `POST /api/admin/logout` | | |
| `GET /api/admin/me` | | `{ admin, expiresAt }` |
| `GET /api/admin/summary` | | Template counts by badge, open flags, review count, last 20 actions |
| `GET /api/admin/flags` | `?status=open` | `{ items }` with the template name |
| `POST /api/admin/flags/:id/resolve` | `{ status: 'dismissed' \| 'upheld', note? }` | |
| `POST /api/admin/templates/:identifier/review` | `{ note }` (3 to 500 chars) | One review per moderator per template. 409 if repeated |
| `POST /api/admin/templates/:identifier/remove` | `{ reason }` (3 to 300 chars) | Also clears the spotlight |
| `POST /api/admin/templates/:identifier/restore` | | |
| `PUT /api/admin/spotlight` | `{ items: [{ identifier, blurb }] }` (at most 6) | Replaces the whole list |

Moderator routes never send the open CORS header. Disable the action buttons until required text is filled in (the server rejects empty notes with a 400).

## Wallet connections (the Demo page)

The demo talks to wallets through one interface, `WalletConnector` in `web/src/voucher/wallet.ts`:

- `start(onStatus, onReady)` returns `{ uri, qrUri }` for the QR code
- `keys(scanPerPath)` lists the public keys the wallet shares
- `sign(request, pathName, addressIndex)` returns signed transaction hex
- `stop()`

`WizardConnectWallet` implements it and is tested with Selene and Paytaca. Another connection method (WalletConnect, a future XO wallet connection) only needs another class with these four methods. The wallet signs a transaction the page built, and the page checks the result before anything is sent.

### Rules that must not be relaxed

- `web/src/voucher/core.ts` builds and verifies every transaction. It is covered by `server/test/voucher-demo.test.ts` and `server/test/spend-probe.test.ts`. Restyle the UI freely, but change `core.ts` only together with its tests.
- Never broadcast a wallet-signed transaction unless `verifySignedIssue` returned `valid`. Never remove that check.
- The claim code is shown before broadcasting and is never stored or sent to a server. The claim link keeps it after the `#`.
- Mainnet needs the explicit real-money confirmation. Chipnet is the default.
- Coins that carry CashTokens are never spent by the demo. `chain.ts` filters them.

## Pages and routes

| Route | File | Purpose |
|---|---|---|
| `/` | `pages/Home.tsx` | Spotlight and intro |
| `/browse` | `pages/Browse.tsx` | Search, badge filter, paging |
| `/t/:identifier` | `pages/Template.tsx` | Detail, audit report, flag form, policy preview |
| `/admin` | `pages/Admin.tsx` | Moderator login and tools |
| `/demo` | `pages/Demo.tsx` | Claim-code voucher demo (chipnet and mainnet) |

## Quick checks before you push

    cd web && npm run build          # type-checks and builds
    cd server && npm test            # all tests must pass
