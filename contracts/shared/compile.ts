/**
 * Compiles every contract system's .cash files into committed artifacts, and prints bytecode size and op count.
 *
 *     npm run compile                    # all systems
 *     npm run compile -- revenue-split   # one system
 *
 * Artifacts are committed so reviewers can diff the exact bytecode a template embeds. The `updatedAt` field is
 * dropped so recompiling unchanged code leaves the file unchanged.
 */
import { readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, basename } from 'node:path';
import { compileFile } from 'cashc';

const root = join(import.meta.dirname, '..');
const only = process.argv[2];
const systems = readdirSync(root).filter(
    (name) => !name.startsWith('_') && !['node_modules', 'shared'].includes(name) && statSync(join(root, name)).isDirectory(),
);

for (const system of systems.filter((name) => !only || name === only)) {
    for (const file of readdirSync(join(root, system)).filter((name) => name.endsWith('.cash'))) {
        const artifact = compileFile(join(root, system, file));
        const { updatedAt: _ignored, ...stable } = artifact as typeof artifact & { updatedAt?: string };
        const outDir = join(root, system, 'artifact');
        const opcodes = artifact.bytecode.split(' ').filter((token) => token.startsWith('OP_')).length;

        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `${basename(file, '.cash')}.json`), `${JSON.stringify(stable, null, 2)}\n`);
        console.log(`${system}/${file}: ${artifact.debug?.bytecode ? artifact.debug.bytecode.length / 2 : '?'} bytes of contract code, ${opcodes} opcodes`);
    }
}
