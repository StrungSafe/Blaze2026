/**
 * The Badgers Stake XO template: it must build exactly the deployed BadgerStake contract (same redeem script, same
 * address as badgers.cash), resolve every output (including the commitments it builds as hex text) to the bytes the
 * contract requires, build spends the VM accepts, and pass the registry's automated audit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bigIntToVmNumber, binToHex, encodeDataPush, hexToBin, lockingBytecodeToCashAddress, type Output } from '@bitauth/libauth';
import { completeMergedInput } from '@xo-cash/engine';
import { compileCashAssemblyString, generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { compileString } from 'cashc-0.10';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../../../server/src/audit/index.js';
import artifact from '../artifact/BadgerStake.json' with { type: 'json' };
import { badgersStakeTemplate } from '../template.js';
import { compileLock, compileScript, completeOutput, p2pkhLockingBytecode, spendSize, testKey, verifySpend, type SpentCoin, type TemplateVariables } from '../../shared/vm.js';

// The badgers.cash contract: its masterBadger (category 242f6ece…) and 52 stake locks were there on 2026-11-18.
const MAINNET_ADDRESS = 'bitcoincash:rvgcl3xk6nwqlngkk09e7g67x5vxs57jv6v2q4qm4ct5yv4d3ppfgdzhpuxn8';
const DEPLOYED_CATEGORY_BYTES = 'd7ff0a63d5c1cbe1ced509314fe3caca563a73095be37734744c40dbce6e2f24';

// Parse the object directly: a JSON round trip of our own would turn bigints into plain strings.
const template = parseTemplate(badgersStakeTemplate as Parameters<typeof parseTemplate>[0]);
const lock = compileLock(template, 'badgerLockingScript', {});
const redeem = compileScript(template, 'badgerBytecode', {});
const category = hexToBin(template.constants!.badgerCategory!.value as string);
const ADMIN = testKey(2);
const STAKER = testKey(3);
const SUPPLY = 1_000_000_000n;

type Resolved = ReturnType<typeof completeOutput>;
const asOutput = (output: Resolved): Output => ({
    lockingBytecode: output.lockingBytecode as Uint8Array,
    valueSatoshis: output.valueSatoshis as bigint,
    ...(output.token ? { token: output.token as Output['token'] } : {}),
});
const commitmentOf = (output: Resolved): string => binToHex((output.token as { nft: { commitment: Uint8Array } }).nft.commitment);
const unlockWith = (script: string, variables: TemplateVariables): Uint8Array => new Uint8Array([...compileScript(template, script, variables), ...encodeDataPush(redeem)]);
/** A template script evaluated the way the engine evaluates token fields: variables as text, result read as text. */
const asText = (script: string, variables: Record<string, unknown> = {}): string =>
    compileCashAssemblyString({ cashAssemblyText: `$(${script})`, variables, evaluationDecodeMode: 'utf8', templateVariables: template.variables, templateScripts: template.scripts } as never);
const bytes2Hex = (value: bigint): string => {
    const number = bigIntToVmNumber(value);

    return binToHex(new Uint8Array([number[0] ?? 0, number[1] ?? 0]));
};

// A masterBadger as badgers.cash runs it: a 1000-sat fee, padding, the admin's key hash.
const masterCommitment = `${bytes2Hex(1000n)}${'00'.repeat(18)}${ADMIN.publicKeyHashHex}`;
const masterVariables = { masterSatoshis: 5000n, masterTokenAmount: SUPPLY, masterCommitment };
const masterCoin = (unlocking: Uint8Array, valueSatoshis = 5000n): SpentCoin => ({
    lockingBytecode: lock,
    unlockingBytecode: unlocking,
    valueSatoshis,
    token: { category, amount: SUPPLY, nft: { capability: 'minting', commitment: hexToBin(masterCommitment) } },
});
const stakeVariables = (stakeSatoshis: bigint, stakeBlocks: bigint, stakerCoinSatoshis = stakeSatoshis + 10_000n): TemplateVariables => ({
    ...masterVariables,
    stakeSatoshis,
    stakeBlocks,
    stakerPublicKeyHash: STAKER.publicKeyHashHex,
    stakerCoinSatoshis,
});

describe('Badgers Stake template', () => {
    it('parses, and has a stable canonical identifier', () => {
        const identifier = generateTemplateIdentifier(template);

        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(identifier);
    });

    it('rebuilding BadgerStake.cash with cashc 0.10.0-next.4 reproduces the committed artifact', () => {
        const rebuilt = compileString(readFileSync(join(import.meta.dirname, '..', 'BadgerStake.cash'), 'utf8').replaceAll('\r\n', '\n'));

        expect(rebuilt.bytecode).toBe(artifact.bytecode);
        expect(rebuilt.compiler.version).toBe('0.10.0-next.4');
    });

    it('builds exactly the deployed contract: the artifact’s bytes and the badgers.cash address', () => {
        expect(binToHex(category.slice().reverse())).toBe(DEPLOYED_CATEGORY_BYTES);
        expect(artifact.bytecode).toContain(DEPLOYED_CATEGORY_BYTES);
        expect(redeem.length).toBe(461);

        const address = lockingBytecodeToCashAddress({ bytecode: lock, prefix: 'bitcoincash', tokenSupport: true });

        expect(typeof address === 'string' ? address : address.address).toBe(MAINNET_ADDRESS);
    });

    it('its hex-text helpers match the contract’s encodings', () => {
        for (const value of [0n, 1n, 144n, 255n, 1000n, 32_767n]) {
            expect(asText(`<${value}> hexUint16LE`)).toBe(bytes2Hex(value));
            expect(asText(`<'${bytes2Hex(value)}'> hexTextToUint16LE hexUint16LE`)).toBe(bytes2Hex(value));
        }

        for (const value of [1n, 127n, 128n, 144n, 336_746n, 9_223_372_036_820_064_207n]) {
            expect(asText(`<${value}> binToHexText`)).toBe(binToHex(bigIntToVmNumber(value)));
        }

        expect(asText("<'E803'> hexTextToUint16LE hexUint16LE")).toBe('e803');
    });

    it('deploys a masterBadger with the commitment the contract reads: fee, padding, admin key hash', () => {
        const output = completeOutput(template, 'deploy', 'masterDeployOutput', { masterSatoshis: 1000n, masterTokenAmount: SUPPLY, newStakeFee: 1000n, adminPublicKeyHash: ADMIN.publicKeyHashHex });
        const token = output.token as { category: Uint8Array; amount: bigint; nft: { capability: string } };

        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe(binToHex(lock));
        expect(binToHex(token.category)).toBe(binToHex(category));
        expect(token.amount).toBe(SUPPLY);
        expect(token.nft.capability).toBe('minting');
        expect(commitmentOf(output)).toBe(masterCommitment);
        expect(() => completeOutput(template, 'deploy', 'masterDeployOutput', { masterSatoshis: 1000n, masterTokenAmount: SUPPLY, newStakeFee: 32_768n, adminPublicKeyHash: ADMIN.publicKeyHashHex })).toThrow();
    });

    it('builds stakes the VM accepts, at the exact reward, fee and change', () => {
        for (const [amount, blocks, reward] of [
            [100_000_000n, 144n, 144n],
            [5000n, 20_000n, 1n],
            [1_027_700_000n, 32_767n, 336_746n],
        ] as const) {
            const variables = stakeVariables(amount, blocks);
            const outputs = ['masterAfterStakeOutput', 'lockOutput', 'stakeChangeOutput'].map((identifier) => completeOutput(template, 'stake', identifier, variables));
            const [masterAfter, lockOutput, change] = outputs as [Resolved, Resolved, Resolved];

            expect(masterAfter.valueSatoshis).toBe(5000n + 1000n);
            expect((masterAfter.token as { amount: bigint }).amount).toBe(SUPPLY - reward);
            expect(commitmentOf(masterAfter)).toBe(masterCommitment);
            expect((lockOutput.token as { amount: bigint }).amount).toBe(reward);
            expect(commitmentOf(lockOutput)).toBe(`${STAKER.publicKeyHashHex}${'00'.repeat(18)}${bytes2Hex(blocks)}`);
            expect(change.valueSatoshis).toBe(10_000n - 1000n - 1700n);
            expect(binToHex(change.lockingBytecode as Uint8Array)).toBe(binToHex(p2pkhLockingBytecode(STAKER.publicKeyHash)));

            const coins = [
                masterCoin(unlockWith('unlockStake', variables)),
                { lockingBytecode: p2pkhLockingBytecode(STAKER.publicKeyHash), unlockingBytecode: new Uint8Array(), valueSatoshis: amount + 10_000n, signingKey: STAKER.privateKey },
            ];

            expect(verifySpend(coins, outputs.map(asOutput))).toBe(true);
            // The constant miner fee pays at least 1 sat per byte of the signed transaction.
            expect(spendSize(coins, outputs.map(asOutput))).toBeLessThanOrEqual(1700);
        }
    });

    it('refuses stakes the contract would reject or that could not pay their change', () => {
        expect(() => completeOutput(template, 'stake', 'lockOutput', stakeVariables(4999n, 30_000n))).toThrow();
        expect(() => completeOutput(template, 'stake', 'lockOutput', stakeVariables(5000n, 100n))).toThrow();
        expect(() => completeOutput(template, 'stake', 'lockOutput', stakeVariables(100_000_000n, 32_768n))).toThrow();
        expect(() => completeOutput(template, 'stake', 'lockOutput', stakeVariables(100_000_000n, 0n))).toThrow();
        expect(() => completeOutput(template, 'stake', 'stakeChangeOutput', stakeVariables(100_000_000n, 144n, 100_000_000n + 3000n))).toThrow();
    });

    it('builds a release the VM accepts, after the period, with the Honey NFT recording the reward', () => {
        const variables: TemplateVariables = { lockSatoshis: 100_000_000n, lockTokenAmount: 144n, stakeBlocks: 144n, stakerPublicKeyHash: STAKER.publicKeyHashHex };
        const outputs = ['badgerCoinOutput', 'honeyOutput', 'unstakedOutput'].map((identifier) => completeOutput(template, 'unstake', identifier, variables));
        const lockCommitment = hexToBin(`${STAKER.publicKeyHashHex}${'00'.repeat(18)}${bytes2Hex(144n)}`);
        const input = completeMergedInput(
            { inputIdentifier: 'lockInput', outpointTransactionHash: new Uint8Array(32), outpointIndex: 0 } as never,
            template as never,
            'unstake',
            Object.entries(variables).map(([variableIdentifier, value]) => ({ variableIdentifier, value })) as never,
        );

        expect(commitmentOf(outputs[1] as Resolved)).toBe(`0000${binToHex(bigIntToVmNumber(144n))}`);
        expect((outputs[2] as Resolved).valueSatoshis).toBe(100_000_000n - 3000n);
        expect(input.sequenceNumber).toBe(144);
        expect(
            verifySpend(
                [
                    {
                        lockingBytecode: lock,
                        unlockingBytecode: unlockWith('unlockUnstake', variables),
                        valueSatoshis: 100_000_000n,
                        token: { category, amount: 144n, nft: { capability: 'mutable', commitment: lockCommitment } },
                        sequenceNumber: input.sequenceNumber,
                    },
                ],
                outputs.map(asOutput),
            ),
        ).toBe(true);
    });

    it('builds a withdrawal the VM accepts: the new fee in the commitment, the admin key hash kept', () => {
        const variables: TemplateVariables = { ...masterVariables, masterSatoshis: 50_000n, newStakeFee: 500n, adminCoinSatoshis: 3000n, withdrawLockingScript: binToHex(p2pkhLockingBytecode(ADMIN.publicKeyHash)) };
        const outputs = ['masterAfterWithdrawOutput', 'withdrawOutput'].map((identifier) => completeOutput(template, 'withdraw', identifier, variables));

        expect(commitmentOf(outputs[0] as Resolved)).toBe(`${bytes2Hex(500n)}${'00'.repeat(18)}${ADMIN.publicKeyHashHex}`);
        expect((outputs[1] as Resolved).valueSatoshis).toBe(50_000n + 3000n - 2000n);
        expect(
            verifySpend(
                [
                    masterCoin(unlockWith('unlockWithdraw', variables), 50_000n),
                    { lockingBytecode: p2pkhLockingBytecode(ADMIN.publicKeyHash), unlockingBytecode: new Uint8Array(), valueSatoshis: 3000n, signingKey: ADMIN.privateKey },
                ],
                outputs.map(asOutput),
            ),
        ).toBe(true);
    });

    it('fixes the layouts the contract needs', () => {
        const transactions = template.transactions!;

        expect(transactions.stakeTransaction!.inputs).toEqual([
            { input: 'masterStakeInput', inputIndex: 0 },
            { input: 'stakerCoinInput', inputIndex: 1 },
        ]);
        expect(transactions.stakeTransaction!.outputs.map((output) => output.outputIndex)).toEqual([0, 1, 2]);
        expect(transactions.unstakeTransaction!.inputs).toEqual([{ input: 'lockInput', inputIndex: 0 }]);
        expect(transactions.withdrawTransaction!.outputs.map((output) => output.outputIndex)).toEqual([0, 1]);
    });

    it('offers staking, releasing, withdrawing and deploying as start actions', () => {
        expect(template.start.map((entry) => `${entry.action}/${entry.role}`)).toEqual(['stake/staker', 'unstake/staker', 'withdraw/admin', 'deploy/admin']);
    });

    it('committed template.json is current, with bigints in XO extended-JSON form', () => {
        const committed = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');

        expect(committed).toBe(serializeTemplate(template));
        expect(committed).not.toMatch(/"-?\d+n"/);
    });

    it('passes every automated registry audit check with no failures', () => {
        const report = runAudit({ storedJson: serializeTemplate(template), storedIdentifier: generateTemplateIdentifier(template) });
        const failing = report.results.filter((result) => result.status === 'fail');

        expect(failing).toEqual([]);
        expect(report.results.find((result) => result.id === 'compile')?.status).toBe('pass');
    });
});
