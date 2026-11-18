/**
 * Drip Mine: an XO template for the Drip Mine "MEV faucet" by bitcoincashautist
 * (https://gitlab.com/0353F40E/drip-mine, MIT No Attribution), the contract behind https://vox.cash/drip by 2qx.
 *
 * Anyone can fund the Drip Mine address. Each coin there is a tiny recursive covenant: at most once per block (the
 * input's sequence number is 1, so the coin must be at least one block old), anyone can spend it back to the same
 * address minus a small payout. The payout is the transaction fee, so it goes to the miner: miner extractable value.
 *
 *     payout          max(coin * 4392 / 1333036486, 164)   (about 0.00033% per block, so a coin halves in ~4 years)
 *     terminate       a coin of 740 sats or less is paid out whole, into a 0-sat OP_RETURN
 *     redeem script   dripMineBytecode   (no constructor parameters)
 *     unlocking       (empty: DripOrTerminate() takes no arguments and is the only function, so there is no selector)
 *
 * The contract is used exactly as deployed, so this template's address is the address vox.cash/drip and the
 * drip-mine README publish (test/template.test.ts checks this).
 *
 * Run `npm run template:json` after any change to regenerate template.json.
 */
import artifactJson from './artifact/DripMine.json' with { type: 'json' };
import { artifactAsmToCashAssembly } from '../shared/cashscript.js';

const dripperRole = {
    actions: [
        { action: 'drip', role: 'dripper' },
        { action: 'terminate', role: 'dripper' },
    ],
    // Drip Mine coins belong to nobody: never count them toward a wallet's balance or use them to fund anything else.
    balance: { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 as const },
    selectable: false,
};

const dripMineTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Drip Mine',
    description:
        'An MEV faucet. BCH sent to the shared Drip Mine address is released to miners a little at a time: once per block, anyone can spend a Drip Mine coin back to the address minus a small payout, and that payout is the transaction fee. Nothing ever comes back to the funder or the dripper.',
    icon: 'drip',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    resources: [
        {
            name: 'Original Drip Mine contract',
            description: 'drip-mine.cash by bitcoincashautist (MIT No Attribution), compiled with cashc 0.9.3. This template uses it unchanged.',
            url: 'https://gitlab.com/0353F40E/drip-mine/-/blob/5893d50ee9a531e0a31c6a637c3f2213509e8c02/drip-mine.cash',
        },
        {
            name: 'vox.cash/drip',
            description: 'The Drip Mine web app by 2qx, with the same contract and a Libauth wallet template (Unlicense).',
            url: 'https://github.com/2qx/vox/tree/a7f970e40b43080ab8378a0f445f3368ce6792ac/packages/drip',
        },
        {
            name: 'Template, artifact and tests',
            description: 'This template, the rebuilt artifact and the tests that tie it to the live address.',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/tree/main/contracts/drip-mine',
        },
    ],
    roles: {
        funder: {
            name: 'Funder',
            description: 'Sends BCH to the Drip Mine, a gift to future miners. It cannot be taken back.',
            icon: 'send',
        },
        dripper: {
            name: 'Dripper',
            description: 'Anyone who posts a drip. The payout goes to the miner as the fee; the dripper keeps nothing unless they mine the block.',
            icon: 'drip',
        },
    },
    start: [
        { action: 'fund', role: 'funder' },
        // Any wallet can start a drip, but the engine can only spend Drip Mine coins it already tracks: XO 0.1.1-next
        // starts watching the address only after this wallet has funded it.
        { action: 'drip', role: 'dripper' },
        { action: 'terminate', role: 'dripper' },
    ],
    actions: {
        fund: {
            name: 'Fund the Drip Mine',
            description:
                'Send $(<fundSatoshis>) satoshis to the Drip Mine. Nobody can get them back: they are released to miners as transaction fees, at most once per block per coin.',
            icon: 'send',
            roles: {
                funder: {
                    name: 'Fund the Drip Mine',
                    description: 'Choose how many satoshis to give. A coin of 740 sats or less is paid out whole at its next spend; larger coins drip slowly.',
                    icon: 'send',
                    requirements: { variables: ['fundSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'funder', slots: { min: 1, max: 1 } }] },
            transaction: 'fundTransaction',
        },
        drip: {
            name: 'Drip',
            description:
                'Release the largest payout the contract allows from a Drip Mine coin of $(<dripCoinSatoshis>) satoshis. The payout is the transaction fee and goes to the miner; the rest returns to the Drip Mine.',
            icon: 'drip',
            roles: {
                dripper: {
                    name: 'Drip',
                    description: 'Pick one Drip Mine coin of more than 740 sats, at least one block old, and enter its value.',
                    icon: 'drip',
                    requirements: { variables: ['dripCoinSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'dripper', slots: { min: 1, max: 1 } }] },
            transaction: 'dripTransaction',
        },
        terminate: {
            name: 'Terminate a spent-down coin',
            description:
                'Pay out a Drip Mine coin of $(<dripCoinSatoshis>) satoshis (740 or less) whole, as the transaction fee, ending it with a 0-sat OP_RETURN.',
            icon: 'drip',
            roles: {
                dripper: {
                    name: 'Terminate',
                    description: 'Pick one Drip Mine coin of 740 sats or less, at least one block old, and enter its value.',
                    icon: 'drip',
                    requirements: { variables: ['dripCoinSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'dripper', slots: { min: 1, max: 1 } }] },
            transaction: 'terminateTransaction',
        },
    },
    transactions: {
        fundTransaction: {
            name: 'Drip Mine funded',
            description: '$(<fundSatoshis>) satoshis were given to the Drip Mine.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'fundingOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        // Both spends: exactly one input and one output (the contract checks both counts), and version 2 so the
        // input's sequence number works as a relative timelock.
        dripTransaction: {
            name: 'Drip',
            description: 'A Drip Mine coin of $(<dripCoinSatoshis>) satoshis paid $(dripPayout) satoshis to the miner.',
            icon: 'drip',
            inputs: [{ input: 'dripMineInput', inputIndex: 0 }],
            outputs: [{ output: 'dripRemainderOutput', outputIndex: 0 }],
            version: 2,
            locktime: 0,
            composable: false,
        },
        terminateTransaction: {
            name: 'Drip Mine coin terminated',
            description: 'A Drip Mine coin of $(<dripCoinSatoshis>) satoshis was paid out whole to the miner.',
            icon: 'drip',
            inputs: [{ input: 'dripMineInput', inputIndex: 0 }],
            outputs: [{ output: 'terminalOutput', outputIndex: 0 }],
            version: 2,
            locktime: 0,
            composable: false,
        },
    },
    outputs: {
        fundingOutput: {
            name: 'Drip Mine coin',
            description: '$(<fundSatoshis>) satoshis at the Drip Mine address, released to miners over time.',
            icon: 'drip',
            lockingScript: 'dripMineLockingScript',
            // checkFunding refuses an amount below the P2SH32 dust limit, which no node would relay.
            valueSatoshis: '$(checkFunding <fundSatoshis>)',
            token: null,
        },
        dripRemainderOutput: {
            name: 'Drip Mine coin (after the drip)',
            description: 'What is left of the coin after the drip, back at the Drip Mine address.',
            icon: 'drip',
            lockingScript: 'dripMineLockingScript',
            // checkDripCoin refuses a coin small enough that the contract requires termination instead.
            valueSatoshis: '$(checkDripCoin <dripCoinSatoshis> dripPayout OP_SUB)',
            token: null,
        },
        terminalOutput: {
            name: 'Terminal OP_RETURN',
            description: 'A bare OP_RETURN with 0 satoshis: the whole coin went to the miner as the fee.',
            icon: 'drip',
            lockingScript: 'terminalLockingScript',
            // checkTerminalCoin refuses a coin large enough that the contract requires a drip instead.
            valueSatoshis: '$(checkTerminalCoin <0>)',
            token: null,
        },
    },
    inputs: {
        dripMineInput: {
            name: 'Drip Mine coin',
            description: 'A coin at the Drip Mine address, at least one block old.',
            icon: 'drip',
            unlockingScript: 'unlockDrip',
            // The contract starts with `1 OP_CHECKSEQUENCEVERIFY` (tx.age >= 1): a relative timelock of one block.
            sequenceNumber: 1,
            // Nothing from this input comes back as change: what is not returned to the Drip Mine is the miner's fee.
            omitChangeAmounts: { satoshis: true, fungibleTokens: true, nonfungibleTokens: true },
        },
    },
    lockingScripts: {
        dripMineLockingScript: {
            name: 'Drip Mine',
            description: 'The shared Drip Mine address. Anything sent here can only ever be released to miners.',
            icon: 'drip',
            lockingType: 'p2sh',
            lockingBytecode: 'dripMineBytecode',
            unlockingBytecode: 'unlockDrip',
            state: { variables: [] },
            actions: [],
            balance: dripperRole.balance,
            selectable: false,
            roles: {
                dripper: dripperRole,
            },
        },
        terminalLockingScript: {
            name: 'OP_RETURN',
            description: 'A bare OP_RETURN, exactly the byte 0x6a, as the contract requires when it terminates a coin.',
            icon: 'drip',
            lockingType: 'p2s',
            lockingBytecode: 'terminalBytecode',
        },
    },
    scripts: {
        dripMineBytecode: artifactAsmToCashAssembly(artifactJson.bytecode),
        unlockDrip: '',
        terminalBytecode: 'OP_RETURN',
        // The contract's maxPayout, which this template always takes in full: the same integer maths, floor division.
        dripPayout: '<dripCoinSatoshis> <decayNumerator> OP_MUL <decayDenominator> OP_DIV <minPayout> OP_MAX',
        // Each check fails (so the engine refuses to build the output) instead of letting a node reject the spend.
        checkFunding: '<fundSatoshis> <dustLimit> OP_GREATERTHANOREQUAL OP_VERIFY',
        checkDripCoin: '<dripCoinSatoshis> <dustLimit> <minPayout> OP_ADD OP_GREATERTHAN OP_VERIFY',
        checkTerminalCoin: '<dripCoinSatoshis> <dustLimit> <minPayout> OP_ADD OP_LESSTHANOREQUAL OP_VERIFY',
    },
    // The contract's hard-coded numbers, for the value expressions above. They are not parameters: the redeem script
    // embeds them, and test/template.test.ts checks these match it.
    constants: {
        dustLimit: {
            name: 'Dust limit',
            description: 'The smallest Drip Mine coin a drip may leave behind: the P2SH32 dust limit, 576 satoshis.',
            type: 'satoshis',
            value: 576n,
        },
        minPayout: {
            name: 'Minimum payout',
            description: 'The flat payout when the proportional one is smaller: 164 satoshis, the drip transaction size at 1 sat/byte.',
            type: 'satoshis',
            value: 164n,
        },
        decayNumerator: {
            name: 'Decay numerator',
            description: 'With the denominator, the share of a coin each drip may release: 4392 / 1333036486, a half-life of about four years.',
            type: 'integer',
            value: 4392n,
        },
        decayDenominator: {
            name: 'Decay denominator',
            description: 'With the numerator, the share of a coin each drip may release.',
            type: 'integer',
            value: 1333036486n,
        },
    },
    variables: {
        fundSatoshis: {
            name: 'Satoshis to give',
            description: 'How many satoshis to send to the Drip Mine (at least 576). They go to miners, never back to you.',
            type: 'satoshis',
        },
        dripCoinSatoshis: {
            name: 'Coin value',
            description: 'The value in satoshis of the Drip Mine coin being spent. The contract rejects the spend if it does not match.',
            type: 'satoshis',
        },
    },
};

export { dripMineTemplate };
