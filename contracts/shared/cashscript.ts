/**
 * Helpers for moving CashScript artifacts into XO templates.
 */
import type { Artifact } from 'cashscript';

/**
 * Types a committed artifact JSON file as a CashScript Artifact. `npm run compile` drops `updatedAt` so recompiling
 * unchanged code leaves the file unchanged; the SDK never reads that field.
 */
export function toArtifact(json: unknown): Artifact {
    return { updatedAt: '', ...(json as Omit<Artifact, 'updatedAt'>) };
}

/**
 * Converts the ASM in a cashc artifact (`artifact.bytecode`) to CashASM for a template's `scripts`.
 *
 * cashc writes opcodes as `OP_*` and data pushes as bare hex (`1027`). CashASM needs pushes written as `<0x1027>`.
 * Both compile to the same bytes: a minimal push of that data.
 */
export function artifactAsmToCashAssembly(asm: string): string {
    return asm
        .trim()
        .split(/\s+/)
        .map((token) => {
            if (token.startsWith('OP_')) {
                return token;
            }

            if (!/^([0-9a-f]{2})+$/i.test(token)) {
                throw new Error(`Unexpected token in cashc ASM: ${token}`);
            }

            return `<0x${token.toLowerCase()}>`;
        })
        .join(' ');
}
