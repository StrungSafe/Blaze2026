/**
 * The Token Burner XO template: it must build exactly the deployed TokenBurner contract (same redeem script, same
 * address as tokenburner.cash), resolve deposit tokens the way the engine does, build a burn the VM accepts, and pass
 * the registry's automated audit.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { binToHex, encodeDataPush, hexToBin, lockingBytecodeToCashAddress, utf8ToBin } from '@bitauth/libauth';
import { generateTemplateIdentifier, parseTemplate, serializeTemplate } from '@xo-cash/utils';
import { compileString } from 'cashc-0.9';
import { describe, expect, it } from 'vitest';
import { runAudit } from '../../../server/src/audit/index.js';
import artifact from '../artifact/Burner.json' with { type: 'json' };
import { tokenBurnerTemplate } from '../template.js';
import { compileLock, compileScript, completeOutput, verifySpend, type TemplateVariables } from '../../shared/vm.js';

// Published by tokenburner.cash (derived in its js/mint.ts from js/burner.json at upstream commit f2024075).
const DEPLOYED_REDEEM_SCRIPT = 'c4519d00d10088016a00cd517f7587';
const MAINNET_ADDRESS = 'bitcoincash:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlc2s5qtune';
const CHIPNET_ADDRESS = 'bchtest:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlcfh97n0xt';

// Parse the object directly: a JSON round trip of our own would turn bigints into plain strings.
const template = parseTemplate(tokenBurnerTemplate as Parameters<typeof parseTemplate>[0]);
const category = 'ab'.repeat(32);

function address(bytecode: Uint8Array, prefix: 'bitcoincash' | 'bchtest'): string {
    const result = lockingBytecodeToCashAddress({ bytecode, prefix, tokenSupport: true });

    if (typeof result === 'string') {
        throw new Error(result);
    }

    return result.address;
}

describe('Token Burner template', () => {
    it('parses, and has a stable canonical identifier', () => {
        const identifier = generateTemplateIdentifier(template);

        expect(identifier).toMatch(/^[0-9a-f]{64}$/);
        expect(generateTemplateIdentifier(parseTemplate(serializeTemplate(template)))).toBe(identifier);
    });

    it('rebuilding burner.cash with cashc 0.9.3 reproduces the committed artifact', () => {
        const rebuilt = compileString(readFileSync(join(import.meta.dirname, '..', 'burner.cash'), 'utf8'));

        expect(rebuilt.bytecode).toBe(artifact.bytecode);
        expect(rebuilt.compiler.version).toBe('0.9.3');
    });

    it('builds exactly the deployed contract: same redeem script and the address tokenburner.cash publishes', () => {
        expect(binToHex(compileScript(template, 'burnerBytecode', {}))).toBe(DEPLOYED_REDEEM_SCRIPT);

        const lock = compileLock(template, 'burnerLockingScript', {});

        expect(address(lock, 'bitcoincash')).toBe(MAINNET_ADDRESS);
        expect(address(lock, 'bchtest')).toBe(CHIPNET_ADDRESS);
    });

    it('resolves a fungible-token deposit the way the engine builds it', () => {
        const output = completeOutput(template, 'depositFungibleTokens', 'burnerFungibleOutput', {
            tokenCategory: category,
            tokenAmount: 1_000_000n,
            depositSatoshis: 1000n,
        });

        const token = output.token as { category: Uint8Array; amount: bigint; nft?: unknown };

        expect(output.valueSatoshis).toBe(1000n);
        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe(binToHex(compileLock(template, 'burnerLockingScript', {})));
        expect(binToHex(token.category)).toBe(category);
        expect(token.amount).toBe(1_000_000n);
        expect(token.nft).toBeUndefined();
    });

    it('resolves an NFT deposit the way the engine builds it', () => {
        const output = completeOutput(template, 'depositNonfungibleToken', 'burnerNonfungibleOutput', {
            tokenCategory: category,
            tokenCapability: 'none',
            tokenCommitment: '2342',
            depositSatoshis: 1000n,
        });
        const token = output.token as { category: Uint8Array; amount: bigint; nft: { capability: string; commitment: Uint8Array } };

        expect(output.valueSatoshis).toBe(1000n);
        expect(binToHex(token.category)).toBe(category);
        expect(token.amount).toBe(0n);
        expect(token.nft.capability).toBe('none');
        expect(binToHex(token.nft.commitment)).toBe('2342');
    });

    it('resolves a BCH-only deposit (a gift to miners) to the burner address with no token', () => {
        const output = completeOutput(template, 'depositSatoshis', 'burnerSatoshisOutput', { depositSatoshis: 2000n });

        expect(output.valueSatoshis).toBe(2000n);
        expect(binToHex(output.lockingBytecode as Uint8Array)).toBe(binToHex(compileLock(template, 'burnerLockingScript', {})));
        expect(output.token).toBeUndefined();
    });

    it('offers every deposit and the burn itself as start actions', () => {
        expect(template.start.map((entry) => `${entry.action}/${entry.role}`)).toEqual([
            'depositFungibleTokens/depositor',
            'depositNonfungibleToken/depositor',
            'depositSatoshis/depositor',
            'burn/burner',
        ]);
    });

    it('committed template.json is current, with bigints in XO extended-JSON form', () => {
        const committed = readFileSync(join(import.meta.dirname, '..', 'template.json'), 'utf8');

        expect(committed).toBe(serializeTemplate(template));
        expect(committed).not.toMatch(/"-?\d+n"/);
    });

    it('writes the farewell message into an OP_RETURN, the same way tokenburner.cash does', () => {
        const message = 'goodbye, tokens';

        expect(compileLock(template, 'farewellLockingScript', { burnMessage: message })).toEqual(new Uint8Array([0x6a, ...encodeDataPush(utf8ToBin(message))]));
        // An empty message still produces an output (OP_RETURN OP_0), which the contract accepts.
        expect(binToHex(compileLock(template, 'farewellLockingScript', { burnMessage: '' }))).toBe('6a00');
    });

    it('builds a burn the VM accepts, entirely from template pieces', () => {
        const variables: TemplateVariables = { burnMessage: 'into the void' };
        const burnerCoin = {
            lockingBytecode: compileLock(template, 'burnerLockingScript', {}),
            // unlockBurn is empty, so a P2SH32 spend is just the redeem script push.
            unlockingBytecode: encodeDataPush(compileScript(template, 'burnerBytecode', {})),
            valueSatoshis: 1000n,
            token: { category: hexToBin(category), amount: 1_000_000n },
        };
        const farewell = completeOutput(template, 'burn', 'farewellOutput', variables);

        expect(compileScript(template, 'unlockBurn', variables)).toEqual(new Uint8Array());
        expect(farewell.valueSatoshis).toBe(0n);
        expect(farewell.token).toBeUndefined();
        expect(verifySpend([burnerCoin], [{ lockingBytecode: farewell.lockingBytecode as Uint8Array, valueSatoshis: 0n }])).toBe(true);
    });

    it('passes every automated registry audit check with no failures', () => {
        const report = runAudit({ storedJson: serializeTemplate(template), storedIdentifier: generateTemplateIdentifier(template) });
        const failing = report.results.filter((result) => result.status === 'fail');

        expect(failing).toEqual([]);
        expect(report.results.find((result) => result.id === 'compile')?.status).toBe('pass');
    });
});
