import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { seedAdmins } from './admin.js';
import { buildApp } from './app.js';
import { createDb, migrate } from './db.js';
import { seed } from './seed.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databasePath = process.env.DATABASE_PATH ?? './data/hub.db';

if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
}

const db = createDb(databasePath);

// Creating missing tables on every start is safe and means a fresh container works without a manual step.
await migrate(db);

// A brand-new database would show an empty hub, so load the XO sample templates the first time. Set SEED_ON_EMPTY=0 to skip.
if (process.env.SEED_ON_EMPTY !== '0' && (await db.selectFrom('templates').select('identifier').limit(1).execute()).length === 0) {
    const result = await seed(db);

    console.log(`Empty database: seeded ${result.published} sample templates.`);
}

// ADMIN_IDENTITIES is "label=identity" pairs, comma-separated; an identity is a public key, a P2PKH address or an xpub.
const admins = await seedAdmins(db, process.env.ADMIN_IDENTITIES);

if (admins.skipped.length > 0) {
    console.warn(`ADMIN_IDENTITIES: skipped invalid entries: ${admins.skipped.join(', ')}`);
}

console.log(`Moderators on the allowlist from ADMIN_IDENTITIES: ${admins.added.join(', ') || '(none)'}`);

const app = await buildApp(db, { logger: true, webDir: process.env.WEB_DIR ?? '../web/dist' });

await app.listen({ port, host });
