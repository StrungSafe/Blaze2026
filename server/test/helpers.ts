import { sql } from 'kysely';
import { createDb, createPostgresDb, migrate, type Db } from '../src/db.js';

/**
 * A fresh, migrated database for one test. SQLite in memory by default. Set TEST_DATABASE_URL to a PostgreSQL database
 * (an empty scratch one: its public schema is dropped for every test) to run the same tests against PostgreSQL, with
 * `npm run test:postgres` so the files run one after another.
 */
export async function freshDb(): Promise<Db> {
    const url = process.env.TEST_DATABASE_URL;

    if (!url) {
        const db = createDb(':memory:');

        await migrate(db);

        return db;
    }

    const db = createPostgresDb(url);

    await sql`drop schema public cascade`.execute(db);
    await sql`create schema public`.execute(db);
    await migrate(db);

    return db;
}
