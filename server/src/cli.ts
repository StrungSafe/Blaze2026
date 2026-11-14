import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { createDb, migrate } from './db.js';
import { listTemplates, reauditAll } from './registry.js';
import { seed } from './seed.js';

const USAGE = `Usage: cli <command>

Commands:
  init     Create the database and tables (safe to run again)
  seed     Publish the XO sample templates and set the Home spotlight (safe to run again)
  audit    Re-run the automated audit for every stored template
  list     Print every stored template with its badge

Environment: DATABASE_PATH (default ./data/hub.db)`;

const command = process.argv[2];
const databasePath = process.env.DATABASE_PATH ?? './data/hub.db';

if (!command || !['init', 'seed', 'audit', 'list'].includes(command)) {
    console.error(USAGE);
    process.exit(command ? 1 : 0);
}

if (databasePath !== ':memory:') {
    mkdirSync(dirname(databasePath), { recursive: true });
}

const db = createDb(databasePath);

await migrate(db);

if (command === 'init') {
    console.log(`Database ready at ${databasePath}`);
} else if (command === 'seed') {
    const result = await seed(db);

    console.log(`Seeded: ${result.published} published, ${result.alreadyPresent} already present.`);
} else if (command === 'audit') {
    console.log(`Re-audited ${await reauditAll(db)} templates.`);
} else if (command === 'list') {
    const { items } = await listTemplates(db, { pageSize: 50, sort: 'name' });

    for (const item of items) {
        const counts = item.audit?.counts;

        console.log(
            `${item.identifier.slice(0, 12)}  ${item.badge.padEnd(12)}  ${item.name}` +
                (counts ? `  [pass ${counts.pass}, warn ${counts.warn}, fail ${counts.fail}, skipped ${counts.skipped}]` : ''),
        );
    }
}

await db.destroy();
