import Database from 'better-sqlite3';
import { Kysely, SqliteDialect, type Generated } from 'kysely';

// Keep column types portable (TEXT / INTEGER only, no SQLite-only features) so a later move to PostgreSQL is a
// dialect and migration change, not a rewrite.

export interface TemplatesTable {
    identifier: string;
    name: string;
    description: string;
    json: string;
    publisher: string;
    created_at: string;
    removed: number;
    removed_reason: string | null;
}

export interface AuditReportsTable {
    id: Generated<number>;
    identifier: string;
    checker_version: string;
    results_json: string;
    created_at: string;
}

export interface FlagsTable {
    id: Generated<number>;
    identifier: string;
    reason: string;
    reporter: string;
    status: string;
    created_at: string;
}

export interface ReviewsTable {
    id: Generated<number>;
    identifier: string;
    reviewer_address: string;
    /** Display name of the moderator who gave the review. Null for rows created before labels existed. */
    reviewer_label: string | null;
    signature: string | null;
    note: string;
    created_at: string;
}

export interface AdminsTable {
    address_or_pubkey: string;
    label: string;
    added_at: string;
}

export interface SpotlightTable {
    identifier: string;
    blurb: string;
    position: number;
    added_at: string;
}

export interface ModerationLogTable {
    id: Generated<number>;
    actor: string;
    action: string;
    identifier: string | null;
    note: string;
    created_at: string;
}

export interface DatabaseSchema {
    templates: TemplatesTable;
    audit_reports: AuditReportsTable;
    flags: FlagsTable;
    reviews: ReviewsTable;
    admins: AdminsTable;
    spotlight: SpotlightTable;
    moderation_log: ModerationLogTable;
}

export type Db = Kysely<DatabaseSchema>;

/**
 * Opens (and creates, if needed) the SQLite database at the given path. Use ':memory:' for tests.
 */
export function createDb(path: string): Db {
    const sqlite = new Database(path);
    sqlite.pragma('foreign_keys = ON');

    if (path !== ':memory:') {
        sqlite.pragma('journal_mode = WAL');
    }

    return new Kysely<DatabaseSchema>({ dialect: new SqliteDialect({ database: sqlite }) });
}

/**
 * Creates all tables if they do not exist yet. Safe to run on every start.
 */
export async function migrate(db: Db): Promise<void> {
    await db.schema
        .createTable('templates')
        .ifNotExists()
        .addColumn('identifier', 'text', (c) => c.primaryKey())
        .addColumn('name', 'text', (c) => c.notNull())
        .addColumn('description', 'text', (c) => c.notNull())
        .addColumn('json', 'text', (c) => c.notNull())
        .addColumn('publisher', 'text', (c) => c.notNull())
        .addColumn('created_at', 'text', (c) => c.notNull())
        .addColumn('removed', 'integer', (c) => c.notNull().defaultTo(0))
        .addColumn('removed_reason', 'text')
        .execute();

    await db.schema
        .createTable('audit_reports')
        .ifNotExists()
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('identifier', 'text', (c) => c.notNull().references('templates.identifier'))
        .addColumn('checker_version', 'text', (c) => c.notNull())
        .addColumn('results_json', 'text', (c) => c.notNull())
        .addColumn('created_at', 'text', (c) => c.notNull())
        .execute();

    await db.schema
        .createTable('flags')
        .ifNotExists()
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('identifier', 'text', (c) => c.notNull().references('templates.identifier'))
        .addColumn('reason', 'text', (c) => c.notNull())
        .addColumn('reporter', 'text', (c) => c.notNull())
        .addColumn('status', 'text', (c) => c.notNull().defaultTo('open'))
        .addColumn('created_at', 'text', (c) => c.notNull())
        .execute();

    await db.schema
        .createTable('reviews')
        .ifNotExists()
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('identifier', 'text', (c) => c.notNull().references('templates.identifier'))
        .addColumn('reviewer_address', 'text', (c) => c.notNull())
        .addColumn('reviewer_label', 'text')
        .addColumn('signature', 'text')
        .addColumn('note', 'text', (c) => c.notNull())
        .addColumn('created_at', 'text', (c) => c.notNull())
        .execute();

    await db.schema
        .createTable('admins')
        .ifNotExists()
        .addColumn('address_or_pubkey', 'text', (c) => c.primaryKey())
        .addColumn('label', 'text', (c) => c.notNull())
        .addColumn('added_at', 'text', (c) => c.notNull())
        .execute();

    await db.schema
        .createTable('spotlight')
        .ifNotExists()
        .addColumn('identifier', 'text', (c) => c.primaryKey().references('templates.identifier'))
        .addColumn('blurb', 'text', (c) => c.notNull())
        .addColumn('position', 'integer', (c) => c.notNull())
        .addColumn('added_at', 'text', (c) => c.notNull())
        .execute();

    await db.schema
        .createTable('moderation_log')
        .ifNotExists()
        .addColumn('id', 'integer', (c) => c.primaryKey().autoIncrement())
        .addColumn('actor', 'text', (c) => c.notNull())
        .addColumn('action', 'text', (c) => c.notNull())
        .addColumn('identifier', 'text')
        .addColumn('note', 'text', (c) => c.notNull())
        .addColumn('created_at', 'text', (c) => c.notNull())
        .execute();

    await upgradeSchema(db);
}

/**
 * Adds columns introduced after the first release to databases created earlier. Uses Kysely introspection so the same
 * code works on SQLite and PostgreSQL.
 */
export async function upgradeSchema(db: Db): Promise<void> {
    const tables = await db.introspection.getTables();
    const reviews = tables.find((table) => table.name === 'reviews');

    if (reviews && !reviews.columns.some((column) => column.name === 'reviewer_label')) {
        await db.schema.alterTable('reviews').addColumn('reviewer_label', 'text').execute();
    }
}
