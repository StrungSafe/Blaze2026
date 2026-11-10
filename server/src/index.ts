import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { buildApp } from './app.js';
import { createDb, migrate } from './db.js';

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';
const databasePath = process.env.DATABASE_PATH ?? './data/hub.db';

if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
}

const db = createDb(databasePath);

// Creating missing tables on every start is safe and means a fresh container works without a manual step.
await migrate(db);

const app = await buildApp(db, { logger: true });

await app.listen({ port, host });
