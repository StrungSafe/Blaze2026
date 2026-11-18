# Hosting XOGrid for free

Three pieces, all on free tiers:

| Piece | Host | Holds |
| --- | --- | --- |
| Frontend (`frontend/`) | Vercel | The website. Calls `/api/...` on its own address. |
| API server (`server/`, `server/Dockerfile`) | Render (free web service) | The hub API only. Stateless: it keeps nothing on its own disk. |
| Database | Supabase (free Postgres) | Templates, audit reports, community reviews, flags, moderators, moderation log. |

Because the server keeps nothing on disk, a Render restart, sleep or redeploy loses nothing. The server re-seeds the
sample templates only when the database is empty.

## One-time setup (about 20 minutes)

### 1. Supabase
1. Create a free project. Pick a region close to the Render region you will choose in step 2. Save the database password.
2. Click **Connect** and copy the **Session pooler** connection string (port 5432). Use the pooler, not the direct
   connection: the direct one is IPv6-only on the free plan and Render may not reach it.
3. Put the real password in the string. If the password contains `@ / ? # %`, percent-encode them (`@` becomes `%40`).
4. Keep the string out of the repo and out of chat. It goes only into Render, below.

### 2. Render
1. New > Web Service > connect `XOGrid-Cash/Blaze2026_XOGrid`, branch `main`.
2. Runtime **Docker**. Root directory `server`, Dockerfile path `./Dockerfile` (the API-only image in `server/Dockerfile`; Vercel serves the website, so Render does not build the frontend). Instance type **Free**. Choose a region near Supabase.
   The root `Dockerfile` is a different thing: one image with API and website together, used by `docker compose up` for running everything locally.
3. Health check path: `/api/health`.
4. Environment variables:

| Name | Value |
| --- | --- |
| `DATABASE_URL` | the Supabase Session pooler string |
| `ADMIN_IDENTITIES` | `label=publickey` pairs, comma-separated (see below) |
| `SEED_ON_EMPTY` | `1` |

   Render sets `PORT` itself; the server listens on it. Leave auto-deploy on, so every push to `main` redeploys.
5. When the deploy is live, open `https://<name>.onrender.com/api/health`. `{"ok":true}` means the server reached the
   database. `/api/templates` should list 6 templates.

### 3. Keep it awake
Render's free service sleeps after 15 minutes without traffic (about a minute to wake) and a free Supabase project
pauses when idle. `/api/health` touches the database, so one free pinger covers both: create an UptimeRobot HTTP monitor
on `https://<name>.onrender.com/api/health`, every 5 minutes.

### 4. Point Vercel at the server
In `frontend/vercel.json`, add this rewrite **above** the existing one (order matters):

```json
{ "source": "/api/(.*)", "destination": "https://<name>.onrender.com/api/$1" }
```

Same-origin calls avoid CORS. Do not set `VITE_API_URL` on Vercel.

### 5. Banner values on Vercel (optional)
The top banner shows the repo link and the EMBER2026 address by default (defaults live in `frontend/src/config/banner.ts`).
To set the slides link, add `VITE_SLIDES_URL` under Vercel > Settings > Environment Variables and redeploy; Vite bakes
it in at build time. Until it is set the banner says "Slides: link coming soon".

## Moderators
`ADMIN_IDENTITIES` is read at every start and added to the allowlist. An entry is `label=identity`, where the identity is
a compressed public key (66 hex characters starting `02` or `03`), a P2PKH address or an xpub. To find a key: try to log
in at the Admin page with that wallet. The rejection message prints the exact entry to add.

## Checks after each deploy
1. `/api/health` returns `{"ok":true}`.
2. `/explore` lists 6 templates.
3. Post a review, then restart the Render service (Manual Deploy > Restart). The review is still there.
4. Moderator login works and hide/unhide survives a restart.

## Local development
Without `DATABASE_URL` the server uses a SQLite file (`DATABASE_PATH`, default `./data/hub.db`) exactly as before.
To run the tests against Postgres: `TEST_DATABASE_URL=postgres://... npm run test:postgres` in `server/`
(use an empty scratch database; its `public` schema is wiped for every test).

**Never point `TEST_DATABASE_URL` at the live Supabase database.** The Postgres tests wipe the `public` schema, which
would delete every template, review and moderator. Running `npm run dev` with the live `DATABASE_URL` is also not a
sandbox: reviews, flags and moderator actions made locally are written to the live data. For local work leave
`DATABASE_URL` unset. Keep the real string in Render only; if it is ever pasted into chat, a file in the repo or a
screenshot, rotate the database password in Supabase and update Render.

## Growing later
Nothing in the code changes. Upgrade Render to a paid instance to remove sleeping, and Supabase to Pro for backups
and no pausing.
