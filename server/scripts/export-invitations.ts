/**
 * Saves every invitation of the demo wallet (.xo-demo/) as a JSON file you can paste or upload into the
 * Blaze Tool at https://blaze.xo.cash/. The file holds exactly what @xo-cash/utils serializeInvitation produces,
 * which is the shareable part of an invitation. It contains no private keys or secrets.
 *
 *     npx tsx scripts/export-invitations.ts
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createChipnetEngine } from './_engine.js';
import { serializeInvitation } from '@xo-cash/utils';

const FOLDER = join(process.cwd(), '.xo-demo');
const OUT = join(FOLDER, 'invitations');
const mnemonic = readFileSync(join(FOLDER, 'mnemonic.txt'), 'utf8').trim();

mkdirSync(OUT, { recursive: true });

const engine = await createChipnetEngine(mnemonic, FOLDER);

try {
    const stored = await engine.listInvitations();

    for (const item of stored) {
        const result = item.invitation.result?.transactions ?? {};
        const executed = Object.values(result).some((transaction) => 'broadcastedAtTimestamp' in transaction);
        const file = join(OUT, `${item.invitation.actionIdentifier}-${item.invitation.invitationIdentifier}${executed ? '-executed' : ''}.json`);

        writeFileSync(file, serializeInvitation(item.invitation));
        console.log(`${executed ? 'EXECUTED' : 'open    '}  ${file}`);
    }

    console.log(`\n${stored.length} invitation(s) saved. Open https://blaze.xo.cash/ and paste or upload the contents of an -executed.json file.`);
} finally {
    await engine.stop().catch(() => undefined);
    process.exit(0);
}
