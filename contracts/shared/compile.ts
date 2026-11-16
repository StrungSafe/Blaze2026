/**
 * Compiles every contract system's .cash files into committed artifacts, and prints bytecode size and op count.
 *
 *     npm run compile                    # all systems
 *     npm run compile -- revenue-split   # one system
 *
 * Each file is compiled with the cashc version its `pragma cashscript` asks for, so contracts adopted from other
 * projects are rebuilt with their original compiler and keep their deployed bytecode (and address). Artifacts are
 * committed so reviewers can diff the exact bytecode a template embeds. `updatedAt` is dropped so recompiling
 * unchanged code leaves the file unchanged.
 */
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import * as cashc014 from 'cashc';
import * as cashc09 from 'cashc-0.9';

/** Supported compilers, matched against the version range in a file's pragma. */
const COMPILERS = [
    { pragma: /^\^0\.9\.\d+$/, version: '0.9.3', compileFile: cashc09.compileFile },
    { pragma: /^\^0\.14\.\d+$/, version: '0.14.0', compileFile: cashc014.compileFile },
];

const root = join(import.meta.dirname, '..');
const only = process.argv[2];
const systems = readdirSync(root).filter(
    (name) => !name.startsWith('_') && !['node_modules', 'shared'].includes(name) && statSync(join(root, name)).isDirectory(),
);

function compilerFor(file: string): (typeof COMPILERS)[number] {
    const pragma = /pragma\s+cashscript\s+([^;]+);/.exec(readFileSync(file, 'utf8'))?.[1]?.trim();
    const compiler = COMPILERS.find((candidate) => pragma && candidate.pragma.test(pragma));

    if (!compiler) {
        throw new Error(`${file}: no compiler configured for pragma "${pragma ?? '(none)'}". Add one to COMPILERS in shared/compile.ts.`);
    }

    return compiler;
}

for (const system of systems.filter((name) => !only || name === only)) {
    for (const file of readdirSync(join(root, system)).filter((name) => name.endsWith('.cash'))) {
        const source = join(root, system, file);
        const compiler = compilerFor(source);
        const artifact = compiler.compileFile(source) as { contractName: string; bytecode: string; updatedAt?: string; debug?: { bytecode: string } };
        const { updatedAt: _ignored, ...stable } = artifact;
        const outDir = join(root, system, 'artifact');
        const opcodes = artifact.bytecode.split(' ').filter((token) => token.startsWith('OP_')).length;

        mkdirSync(outDir, { recursive: true });
        writeFileSync(join(outDir, `${artifact.contractName}.json`), `${JSON.stringify(stable, null, 2)}\n`);
        console.log(`${system}/${file} (cashc ${compiler.version}): ${artifact.contractName}, ${opcodes} opcodes${artifact.debug ? `, ${artifact.debug.bytecode.length / 2} bytes` : ''}`);
    }
}
