/**
 * Writes each system's canonical template.json and prints its identifier.
 *
 *     npm run template:json                    # all systems
 *     npm run template:json -- revenue-split   # one system
 *
 * template.json is `serializeTemplate(parseTemplate(...))` of the system's template.ts: the exact bytes a registry
 * stores and hashes. Commit it, so reviewers can diff what will be published.
 */
import { existsSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';

const root = join(import.meta.dirname, '..');
const only = process.argv[2];
const systems = readdirSync(root).filter(
    (name) => !name.startsWith('_') && !['node_modules', 'shared'].includes(name) && statSync(join(root, name)).isDirectory(),
);
const bigintSafe = (_key: string, value: unknown): unknown => (typeof value === 'bigint' ? `${value}n` : value);

for (const system of systems.filter((name) => !only || name === only)) {
    const source = join(root, system, 'template.ts');

    if (!existsSync(source)) {
        continue;
    }

    const exported = Object.values(await import(pathToFileURL(source).href)) as unknown[];

    if (exported.length !== 1) {
        throw new Error(`${system}/template.ts must export exactly one template object.`);
    }

    const template = parseTemplate(JSON.stringify(exported[0], bigintSafe));
    const canonical = serializeTemplate(template);

    writeFileSync(join(root, system, 'template.json'), canonical);
    console.log(`${system}: ${generateTemplateIdentifier(parseTemplate(canonical))}`);
}
