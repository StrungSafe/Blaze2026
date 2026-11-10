# XO Template Hub: server

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
