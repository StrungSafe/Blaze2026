/**
 * The Block Points XO template: it must build exactly the deployed BlockPoints vault (same redeem script, same address
 * as vox.cash/bpt), compute the reward the way the vault does, build claims the VM accepts, and pass the registry's
 * automated audit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bigIntToVmNumber, binToHex, encodeDataPush, hexToBin, lockingBytecodeToCashAddress, type Output } from '@bitauth/libauth';
import { completeMergedInput } from '@xo-cash/engine';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../../../server/src/audit/index.js';
import upstream from '../upstream/template.v3.2.json' with { type: 'json' };
import { blockPointsTemplate } from '../template.js';
import { ANYONE_CAN_SPEND, compileLock, compileScript, completeOutput, p2pkhLockingBytecode, testKey, verifySpend, type TemplateVariables } from '../../shared/vm.js';

// The vault vox.cash/bpt uses: P2SH32 of upstream template.v3.2's `lock` script. It holds the 337 BPTS threads on
// mainnet and the tBPTS threads on chipnet.
const DEPLOYED_REDEEM_SCRIPT = 'c2529d03ffff0078a26900cb78a26976b275c0d3c0d07b00c6950400e1f5059694a269c0d1c0ce88c0cdc0c788c0519c';
const MAINNET_ADDRESS = 'bitcoincash:rvlnj38vup2zgng7dg0jqz8cx6up9ucrdde3tejs2vx2ycxjmm5nckv9qk23t';
// The address vox's scripts/airdrop.bpt.bchtest.ts funded the tBPTS threads at.
const CHIPNET_ADDRESS = 'bchtest:rvlnj38vup2zgng7dg0jqz8cx6up9ucrdde3tejs2vx2ycxjmm5nc4t57weye';

// Parse the object directly: a JSON round trip of our own would turn bigints into plain strings.
const template = parseTemplate(blockPointsTemplate as Parameters<typeof parseTemplate>[0]);
const lock = compileLock(template, 'vaultLockingScript', {});
const category = 'bb'.repeat(32);
const claimantLock = p2pkhLockingBytecode(testKey(7).publicKeyHash);
const THREAD_TOKENS = 72_624_976_668_147_841n;

function address(prefix: 'bitcoincash' | 'bchtest'): string {
    const result = lockingBytecodeToCashAddress({ bytecode: lock, prefix, tokenSupport: true });

    if (typeof result === 'string') {
        throw new Error(result);
    }

    return result.address;
}

function claimVariables(age: bigint, claimantCoinSatoshis: bigint, vaultTokenAmount = THREAD_TOKENS): TemplateVariables {
    return { tokenCategory: category, vaultTokenAmount, vaultSatoshis: 800n, claimantCoinSatoshis, age, rewardLockingScript: binToHex(claimantLock) };
}

/** The claim the engine builds from the template, checked in the VM (the claimant coin is an anyone-can-spend stand-in). */
function claimFromTemplate(variables: TemplateVariables): { reward: bigint; verified: true | string } {
    const age = variables.age as bigint;
    const rewardOutput = completeOutput(template, 'claim', 'rewardOutput', variables);
    const vaultOutput = completeOutput(template, 'claim', 'vaultReturnOutput', variables);
    const asOutput = (output: typeof rewardOutput): Output => ({
        lockingBytecode: output.lockingBytecode as Uint8Array,
        valueSatoshis: output.valueSatoshis as bigint,
        token: output.token as Output['token'],
    });
    const verified = verifySpend(
        [
            { lockingBytecode: ANYONE_CAN_SPEND, unlockingBytecode: new Uint8Array(), valueSatoshis: variables.claimantCoinSatoshis as bigint, sequenceNumber: Number(age) },
            {
                lockingBytecode: lock,
                // unlockRelease is <age>; a P2SH32 spend appends the redeem script push.
                unlockingBytecode: new Uint8Array([...compileScript(template, 'unlockRelease', variables), ...encodeDataPush(compileScript(template, 'vaultBytecode', {}))]),
                valueSatoshis: 800n,
                token: { category: hexToBin(category), amount: variables.vaultTokenAmount as bigint },
                sequenceNumber: Number(age),
            },
        ],
        [asOutput(rewardOutput), asOutput(vaultOutput)],
    );

    return { reward: (rewardOutput.token as { amount: bigint }).amount, verified };
}

describe('Block Points template', () => {
    it('parses, and has a stable canonical identifier', () => {
        const identifier = generateTemplateIdentifier(template);

        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(identifier);
    });

    it('embeds upstream v3.2’s vault script verbatim', () => {
        expect(template.scripts.vaultBytecode).toBe(upstream.scripts.lock.script);
    });

    it('builds exactly the deployed vault: same redeem script and the addresses vox.cash/bpt uses', () => {
        expect(binToHex(compileScript(template, 'vaultBytecode', {}))).toBe(DEPLOYED_REDEEM_SCRIPT);
        expect(address('bitcoincash')).toBe(MAINNET_ADDRESS);
        expect(address('bchtest')).toBe(CHIPNET_ADDRESS);
    });

    it('its constants are the numbers the redeem script embeds', () => {
        expect(DEPLOYED_REDEEM_SCRIPT).toContain(binToHex(bigIntToVmNumber(BigInt(template.constants!.maximumAge!.value as bigint))));
        expect(DEPLOYED_REDEEM_SCRIPT).toContain(binToHex(bigIntToVmNumber(BigInt(template.constants!.satoshisPerCoin!.value as bigint))));
    });

    it('resolves a thread deposit to the vault with the chosen token, and refuses an empty one', () => {
        const output = completeOutput(template, 'fundThread', 'vaultThreadOutput', { tokenCategory: category, threadTokenAmount: 1_000_000n, threadSatoshis: 800n });
        const token = output.token as { category: Uint8Array; amount: bigint; nft?: unknown };

        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe(binToHex(lock));
        expect(output.valueSatoshis).toBe(800n);
        expect(binToHex(token.category)).toBe(category);
        expect(token.amount).toBe(1_000_000n);
        expect(token.nft).toBeUndefined();
        expect(() => completeOutput(template, 'fundThread', 'vaultThreadOutput', { tokenCategory: category, threadTokenAmount: 0n, threadSatoshis: 800n })).toThrow();
    });

    it('claims the full allowance, and the VM accepts every claim it builds', () => {
        const cases: Array<[bigint, bigint, bigint]> = [
            [1n, 100_000_000n, 1n],
            [144n, 100_000_000n, 144n],
            [10_794n, 25_000_000n, 2_698n],
            // 20 million BCH held for the longest age: still far less than one thread holds.
            [65_535n, 2_000_000_000_000_000n, 1_310_700_000_000n],
        ];

        for (const [age, coin, reward] of cases) {
            const result = claimFromTemplate(claimVariables(age, coin));

            expect(result.reward).toBe(reward);
            expect(result.verified).toBe(true);
        }
    });

    it('sends the reward to the claimant’s address and returns the rest of the thread, satoshis included', () => {
        const variables = claimVariables(144n, 100_000_000n);
        const rewardOutput = completeOutput(template, 'claim', 'rewardOutput', variables);
        const vaultOutput = completeOutput(template, 'claim', 'vaultReturnOutput', variables);

        expect(binToHex(rewardOutput.lockingBytecode as Uint8Array)).toBe(binToHex(claimantLock));
        expect(rewardOutput.valueSatoshis).toBe(800n);
        expect(binToHex(vaultOutput.lockingBytecode as Uint8Array)).toBe(binToHex(lock));
        expect(vaultOutput.valueSatoshis).toBe(800n);
        expect((vaultOutput.token as { amount: bigint }).amount).toBe(THREAD_TOKENS - 144n);
    });

    it('refuses an age outside 1-65535, a reward of zero, and a reward the thread cannot cover', () => {
        expect(() => completeOutput(template, 'claim', 'rewardOutput', claimVariables(0n, 100_000_000n))).toThrow();
        expect(() => completeOutput(template, 'claim', 'rewardOutput', claimVariables(65_536n, 100_000_000n))).toThrow();
        // 2,051 blocks of a 2,500-sat coin is 0.05 of a token, which rounds down to nothing.
        expect(() => completeOutput(template, 'claim', 'rewardOutput', claimVariables(2_051n, 2_500n))).toThrow();
        expect(() => completeOutput(template, 'claim', 'rewardOutput', claimVariables(144n, 100_000_000n, 144n))).toThrow();
    });

    it('gives both inputs the claimed age as their sequence number: a real block-based timelock', () => {
        for (const inputIdentifier of ['claimantCoinInput', 'vaultInput']) {
            const input = completeMergedInput(
                { inputIdentifier, outpointTransactionHash: new Uint8Array(32), outpointIndex: 0 } as never,
                template as never,
                'claim',
                Object.entries(claimVariables(144n, 100_000_000n)).map(([variableIdentifier, value]) => ({ variableIdentifier, value })) as never,
            );

            expect(input.sequenceNumber).toBe(144);
        }
    });

    it('fixes the claim layout the vault needs: coin at input 0, thread at input 1 and output 1', () => {
        const claim = template.transactions!.claimTransaction!;

        expect(claim.inputs).toEqual([
            { input: 'claimantCoinInput', inputIndex: 0 },
            { input: 'vaultInput', inputIndex: 1 },
        ]);
        expect(claim.outputs).toEqual([
            { output: 'rewardOutput', outputIndex: 0 },
            { output: 'vaultReturnOutput', outputIndex: 1 },
        ]);
        expect(claim.version).toBe(2);
    });

    it('offers funding a thread and claiming as start actions', () => {
        expect(template.start.map((entry) => `${entry.action}/${entry.role}`)).toEqual(['fundThread/funder', 'claim/claimant']);
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
