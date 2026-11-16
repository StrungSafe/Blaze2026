/**
 * Test helpers shared by every contract system: compile pieces of an XO template the way the engine does, and run
 * transactions through Libauth's BCH 2026 virtual machine.
 */
import {
    binToHex,
    createVirtualMachineBch2026,
    hash160,
    hexToBin,
    secp256k1,
    type Input,
    type Output,
} from '@bitauth/libauth';
import {
    buildCompilerBytecodeDataFromCompilationVariables,
    compileLockingBytecodeFromTemplateLockingScriptIdentifier,
    completeMergedOutput,
} from '@xo-cash/engine';
import { compileCashAssemblyString, parseTemplate } from '@xo-cash/utils';

export type XOTemplate = ReturnType<typeof parseTemplate>;
export type TemplateVariables = Record<string, string | bigint | number | boolean>;

const vm = createVirtualMachineBch2026();

/** Template constants merged under the given variables, as the engine merges them before compiling. */
function withConstants(template: XOTemplate, variables: TemplateVariables): TemplateVariables {
    const constants = Object.fromEntries(
        Object.entries(template.constants ?? {}).map(([identifier, constant]) => [identifier, constant.value as TemplateVariables[string]]),
    );

    return { ...constants, ...variables };
}

/** The locking bytecode the engine builds for a template locking script. */
export function compileLock(template: XOTemplate, lockingScriptIdentifier: string, variables: TemplateVariables): Uint8Array {
    return compileLockingBytecodeFromTemplateLockingScriptIdentifier(template as never, lockingScriptIdentifier, withConstants(template, variables) as never);
}

/**
 * The bytecode of one named template script, for example a P2SH redeem script. Variables are converted to bytes the
 * way the engine converts them for locking and unlocking scripts (`bytes` values read as hex), not the way it
 * converts them for value expressions (see compileValue).
 */
export function compileScript(template: XOTemplate, scriptIdentifier: string, variables: TemplateVariables): Uint8Array {
    return hexToBin(
        compileCashAssemblyString({
            cashAssemblyText: `$(<${scriptIdentifier}>)`,
            variables: buildCompilerBytecodeDataFromCompilationVariables(template as never, withConstants(template, variables) as never),
            evaluationDecodeMode: 'hex',
            templateVariables: template.variables,
            templateScripts: template.scripts,
        }),
    );
}

/**
 * A template value expression such as an output's `valueSatoshis`, compiled exactly as the engine's
 * resolveTemplateOutputValueSatoshis does. Throws when the expression fails, which is how guards in values work.
 */
export function compileValue(template: XOTemplate, expression: string, variables: TemplateVariables): bigint {
    return BigInt(
        compileCashAssemblyString({
            cashAssemblyText: expression,
            variables: withConstants(template, variables),
            evaluationDecodeMode: 'bigint',
            templateVariables: template.variables,
            templateScripts: template.scripts,
        }),
    );
}

/** A deterministic test key: its private key, public key and 20-byte public key hash. */
export function testKey(seed: number): { privateKey: Uint8Array; publicKey: Uint8Array; publicKeyHash: Uint8Array; publicKeyHashHex: string } {
    const privateKey = new Uint8Array(32).fill(seed);
    const publicKey = secp256k1.derivePublicKeyCompressed(privateKey);

    if (typeof publicKey === 'string') {
        throw new Error(publicKey);
    }

    const publicKeyHash = hash160(publicKey);

    return { privateKey, publicKey, publicKeyHash, publicKeyHashHex: binToHex(publicKeyHash) };
}

/** P2PKH locking bytecode for a 20-byte public key hash. */
export function p2pkhLockingBytecode(publicKeyHash: Uint8Array): Uint8Array {
    return new Uint8Array([0x76, 0xa9, 0x14, ...publicKeyHash, 0x88, 0xac]);
}

/** A coin locked by bare `OP_1`, spendable with an empty unlocking script. Stands in for a fee input in VM tests. */
export const ANYONE_CAN_SPEND = new Uint8Array([0x51]);

export interface SpentCoin {
    lockingBytecode: Uint8Array;
    unlockingBytecode: Uint8Array;
    valueSatoshis: bigint;
    /** CashTokens carried by the coin, in Libauth's Output token shape. */
    token?: Output['token'];
}

/**
 * Resolves one template output exactly as the engine does when it builds a transaction: value, locking bytecode and
 * token, from invitation variables (plain values, `bytes` as hex).
 */
export function completeOutput(
    template: XOTemplate,
    actionIdentifier: string,
    outputIdentifier: string,
    variables: TemplateVariables,
): { valueSatoshis?: bigint; lockingBytecode?: Uint8Array | string; token?: unknown } {
    const invitationVariables = Object.entries(variables).map(([variableIdentifier, value]) => ({ variableIdentifier, value }));

    return completeMergedOutput({ outputIdentifier } as never, 0, invitationVariables as never, template as never, actionIdentifier) as never;
}

/** Builds a version 2 transaction spending `coins` into `outputs`, and returns true when the VM accepts it. */
export function verifySpend(coins: SpentCoin[], outputs: Output[]): true | string {
    const inputs: Input[] = coins.map((coin, index) => ({
        outpointTransactionHash: new Uint8Array(32).fill(index + 1),
        outpointIndex: 0,
        sequenceNumber: 0xffffffff,
        unlockingBytecode: coin.unlockingBytecode,
    }));
    const sourceOutputs: Output[] = coins.map((coin) => ({
        lockingBytecode: coin.lockingBytecode,
        valueSatoshis: coin.valueSatoshis,
        ...(coin.token ? { token: coin.token } : {}),
    }));
    const result = vm.verify({ sourceOutputs, transaction: { version: 2, locktime: 0, inputs, outputs } });

    return result === true ? true : String(result);
}
