# XOGrid: server

Backend for the template registry: publish XO templates, get a canonical identifier, run automated audit checks, show flags and reviews, and preview a wallet trust policy. See `docs/XO SPEC.md` for the full design.

Status: registry, audit v1, flags, policy preview, list/search/spotlight, CLI and tests. **Not built yet:** admin and moderator routes (signed-challenge login), static serving of the React frontend, the demo flow.

## Run it

```bash
yarn install
yarn test            # 23 tests, in-memory database
yarn cli init        # create the database (default ./data/hub.db)
yarn cli seed        # publish the five XO sample templates and the Home spotlight
yarn dev             # http://localhost:3000
```

Production build: `yarn build`, then `yarn cli:prod seed` and `yarn start`.

Environment variables: `PORT` (3000), `HOST` (0.0.0.0), `DATABASE_PATH` (./data/hub.db, use `:memory:` for throwaway).

CLI: `init`, `seed`, `audit` (re-run all audits), `list`.

## API

| Route | Purpose |
|---|---|
| `GET /api/health` | liveness |
| `GET /api/templates?query=&badge=&sort=&page=&pageSize=` | list and search (`sort`: newest, name, flagged) |
| `GET /api/templates/:identifier` | detail with canonical template, audit report, flags, reviews |
| `POST /api/templates` | body `{ template, publisher? }`; `template` is a JSON object or JSON text. 201 new, 200 already present |
| `POST /api/templates/:identifier/flags` | body `{ reason, reporter? }` |
| `GET /api/spotlight` | featured templates for Home |
| `POST /api/policy/evaluate` | body `{ policy: { minBadge?, blockFlagged?, allowIdentifiers?, blockIdentifiers? }, identifier }` |

## Things to know

- **Identifiers are canonical.** The server runs `parseTemplate` before hashing. Hashing a raw object gives a different identifier because `parseTemplate` reorders keys. Never hash raw JSON yourself.
- **Badges:** `unchecked`, `auto-checked` (no failing automated check, not a safety claim), `reviewed` (a stored human review of that exact identifier). Open flags are shown alongside, never instead.
- **Audit checks:** schema, size, identifier, internal references, offline compile (sample values; key-based scripts are skipped), scenarios (informational). The five shipped XO templates all come out auto-checked with a "no scenarios" warning.
- **canvas is stubbed on purpose.** `@xo-cash/state` pulls in `indexeddbshim`, which depends on the native `canvas` package. Building it needs Cairo libraries or fails on some machines (it did on Ubuntu with Node 22). The hub server never loads it, so `package.json` replaces it with the empty registry package `empty-npm-package` (`overrides` for npm, `resolutions` for yarn). Do not remove the override unless you start using the engine's Node storage with images. Browser builds are unaffected.
- **Engine and storage:** `@xo-cash/engine` is pinned to `0.1.1-next.17778370827`. `better-sqlite3` is a native module, so install needs normal internet access (and build tools if no prebuilt binary matches your platform).
- **Database:** SQLite now (better-sqlite3 through Kysely). Columns are plain TEXT/INTEGER so a move to PostgreSQL is a dialect and migration change.
- `Dockerfile` is untested.


## Moderator portal API

Login uses a challenge the server issues, signed by a key on the allowlist. Two proof types are accepted:

- `{"type":"transaction","signedTransaction":"<hex>"}` for WizardConnect wallets such as Selene (they sign transactions only)
- `{"type":"message","signature":"<base64>"}` for wallets that sign Bitcoin Signed Messages

| Route | Purpose |
| --- | --- |
| `POST /api/admin/challenge` | Issue a single-use nonce (5 minutes) |
| `POST /api/admin/login` | `{nonce, proof}` returns a bearer token (1 hour) |
| `POST /api/admin/logout`, `GET /api/admin/me` | Session |
| `GET /api/admin/summary` | Counts and recent actions |
| `GET /api/admin/flags?status=open`, `POST /api/admin/flags/:id/resolve` | Flag queue (`dismissed` or `upheld`) |
| `POST /api/admin/templates/:id/review` | `{note}`; one review per moderator per template |
| `POST /api/admin/templates/:id/remove`, `.../restore` | `{reason}`; removal leaves a tombstone |
| `PUT /api/admin/spotlight` | Replace the Home spotlight (up to 6) |

Allowlist: set `ADMIN_IDENTITIES="alice=<pubkey>,miguel=<xpub>"` (a compressed public key, a P2PKH address, or an
xpub; an xpub matches its first 50 receive keys). It is applied on every start. Sessions are in memory, so a restart
logs moderators out.

Login failures return a generic 401; the real reason goes to the server log only.


## Fetching a template by identifier

`GET /api/templates/:identifier/raw` returns the stored canonical template JSON, ready for `parseTemplate`. Hashing
the response with `generateTemplateIdentifier(parseTemplate(body))` gives back the identifier, so a client can verify
what it received without trusting the hub. Responses are immutable (cached for a year). A removed template answers
`410`. Public read routes send `Access-Control-Allow-Origin: *`; admin routes and all writes never do.

## Moderator CLI

    npm run cli -- admin-add alice 02abc...      # public key, P2PKH address, or xpub
    npm run cli -- admin-list
    npm run cli -- admin-remove 02abc...


## Chipnet gate check

    npx tsx scripts/chipnet-gate.ts                                  # needs internet; uses a throwaway wallet, no funds
    HUB_URL=http://localhost:3000 npx tsx scripts/chipnet-gate.ts    # also pulls a template from your running hub

Checks that `Engine.create` reaches chipnet, that the engine and the hub compute the same template identifier, and
that an invitation can be created from a hub template. It prints the invitation JSON to paste into the Blaze Tool.
