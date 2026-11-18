/**
 * Block Points: an XO template for the BlockPoints vault by 2qx (https://github.com/2qx/vox, Unlicense), the contract
 * behind https://vox.cash/bpt and its BPTS reward token.
 *
 * The vault is a set of "threads": coins at one shared address, each holding a large amount of one fungible token.
 * Anyone can claim from a thread a reward proportional to the value and age of one of their own coins:
 *
 *     reward          age × (claimant coin value) / 100,000,000   (one token per BCH per block of age)
 *     age             at most the age of both the claimant's coin (input 0) and the thread (input 1), up to 65535 blocks
 *     redeem script   vaultBytecode, upstream's hand-written CashASM (latest version, v3.2), used verbatim
 *     unlocking       <age>
 *
 * The contract is used exactly as deployed, so this template's address is the vault address vox.cash/bpt uses
 * (test/template.test.ts checks this).
 *
 * Run `npm run template:json` after any change to regenerate template.json.
 */
import upstreamTemplate from './upstream/template.v3.2.json' with { type: 'json' };

const vaultRoleBalance = { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 as const };

const blockPointsTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Block Points',
    description:
        'A coin-age reward vault. Tokens deposited into the shared BlockPoints vault can be claimed by anyone, at one token per BCH per block that their coin has been held unmoved. The vault releases the BPTS reward token at vox.cash/bpt, and works for any fungible token.',
    icon: 'reward',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    resources: [
        {
            name: 'Original BlockPoints contract',
            description: 'The vault script by 2qx, hand-written CashASM in the Libauth template v3.2 (Unlicense). This template uses it verbatim.',
            url: 'https://github.com/2qx/vox/blob/a7f970e40b43080ab8378a0f445f3368ce6792ac/packages/blockpoint/src/template.v3.2.json',
        },
        {
            name: 'vox.cash/bpt',
            description: 'The Block Points web app by 2qx, with the BPTS vault and claim flow.',
            url: 'https://vox.cash/bpt',
        },
        {
            name: 'Template and tests',
            description: 'This template, the verbatim upstream script and the tests that tie it to the live vault address.',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/tree/main/templates/block-points',
        },
    ],
    roles: {
        funder: {
            name: 'Funder',
            description: 'Deposits tokens into the vault as a new thread, to be claimed by coin holders. The deposit cannot be taken back.',
            icon: 'send',
        },
        claimant: {
            name: 'Claimant',
            description: 'Claims tokens from a vault thread, proportional to the value and age of one of their own coins.',
            icon: 'reward',
        },
    },
    start: [
        { action: 'fundThread', role: 'funder' },
        // Any wallet can start a claim, but the engine can only unlock vault threads it already tracks: XO 0.1.1-next
        // starts watching the vault address only after this wallet has funded a thread or claimed once.
        { action: 'claim', role: 'claimant' },
    ],
    actions: {
        fundThread: {
            name: 'Fund a vault thread',
            description:
                'Deposit $(<threadTokenAmount>) tokens of category $(<tokenCategory>) into the BlockPoints vault. Anyone holding BCH can then claim them, one token per BCH per block of coin age. Nobody can take them back.',
            icon: 'send',
            roles: {
                funder: {
                    name: 'Fund a vault thread',
                    description: 'Choose the token category and amount, and the satoshis the thread holds (about 800).',
                    icon: 'send',
                    requirements: { variables: ['tokenCategory', 'threadTokenAmount', 'threadSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'funder', slots: { min: 1, max: 1 } }] },
            transaction: 'fundThreadTransaction',
        },
        claim: {
            name: 'Claim Block Points',
            description:
                'Claim $(claimReward) tokens of category $(<tokenCategory>) from a vault thread, for holding a coin of $(<claimantCoinSatoshis>) satoshis for $(<age>) blocks.',
            icon: 'reward',
            roles: {
                claimant: {
                    name: 'Claim',
                    description:
                        'Pick one of your plain BCH coins and one vault thread. The age is the number of blocks since the younger of the two was mined (at most 65535). The reward is age × coin value / 100,000,000.',
                    icon: 'reward',
                    requirements: { variables: ['tokenCategory', 'vaultTokenAmount', 'vaultSatoshis', 'claimantCoinSatoshis', 'age', 'rewardLockingScript'] },
                },
            },
            requirements: { participants: [{ role: 'claimant', slots: { min: 1, max: 1 } }] },
            transaction: 'claimTransaction',
        },
    },
    transactions: {
        fundThreadTransaction: {
            name: 'Vault thread funded',
            description: '$(<threadTokenAmount>) tokens of category $(<tokenCategory>) were deposited into the BlockPoints vault.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'vaultThreadOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        // The contract fixes the layout: the claimant's coin at input 0 (its value and sequence number set the reward
        // and prove its age), the thread at input 1 and back at output 1. Change can follow at index 2 and later.
        // Version 2, so sequence numbers work as relative timelocks.
        claimTransaction: {
            name: 'Block Points claimed',
            description: '$(claimReward) tokens of category $(<tokenCategory>) were claimed for a coin of $(<claimantCoinSatoshis>) satoshis held $(<age>) blocks.',
            icon: 'reward',
            inputs: [
                { input: 'claimantCoinInput', inputIndex: 0 },
                { input: 'vaultInput', inputIndex: 1 },
            ],
            outputs: [
                { output: 'rewardOutput', outputIndex: 0 },
                { output: 'vaultReturnOutput', outputIndex: 1 },
            ],
            version: 2,
            locktime: 0,
            composable: false,
        },
    },
    outputs: {
        vaultThreadOutput: {
            name: 'Vault thread',
            description: '$(<threadTokenAmount>) tokens of category $(<tokenCategory>) in the BlockPoints vault.',
            icon: 'reward',
            lockingScript: 'vaultLockingScript',
            valueSatoshis: '$(<threadSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                amount: '$(checkThreadAmount <threadTokenAmount>)',
                nft: null,
            },
        },
        rewardOutput: {
            name: 'Block Points reward',
            description: '$(claimReward) tokens claimed from the vault.',
            icon: 'reward',
            lockingScript: '$(<rewardLockingScript>)',
            valueSatoshis: '$(<rewardOutputSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                // checkClaim refuses an age outside 1-65535 blocks, a reward of zero, or one the thread cannot cover.
                amount: '$(checkClaim claimReward)',
                nft: null,
            },
        },
        vaultReturnOutput: {
            name: 'Vault thread (after the claim)',
            description: 'The thread, back in the vault with the reward taken out.',
            icon: 'reward',
            lockingScript: 'vaultLockingScript',
            // The contract doesn't check the thread's satoshis; the template returns all of them.
            valueSatoshis: '$(<vaultSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                amount: '$(<vaultTokenAmount> claimReward OP_SUB)',
                nft: null,
            },
        },
    },
    inputs: {
        claimantCoinInput: {
            name: 'Your aged coin',
            description: 'A plain BCH coin of yours, unmoved for at least $(<age>) blocks. It is spent and comes back as change, less the fee.',
            icon: 'reward',
            valueSatoshis: '$(<claimantCoinSatoshis>)',
            token: null,
            // The relative timelock that proves the coin's age. The contract only checks sequenceNumber >= age, so the
            // template sets exactly <age>: a block-based lock the network enforces.
            sequenceNumber: '$(<age>)',
        },
        vaultInput: {
            name: 'Vault thread',
            description: 'A BlockPoints vault thread at least $(<age>) blocks old.',
            icon: 'reward',
            valueSatoshis: '$(<vaultSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                amount: '$(<vaultTokenAmount>)',
                nft: null,
            },
            // The contract's OP_CHECKSEQUENCEVERIFY checks this input's own sequence number against <age>.
            sequenceNumber: '$(<age>)',
            unlockingScript: 'unlockRelease',
        },
    },
    lockingScripts: {
        vaultLockingScript: {
            name: 'BlockPoints vault',
            description: 'The shared BlockPoints vault. Tokens here can only be released to coin holders, a little per block.',
            icon: 'reward',
            lockingType: 'p2sh',
            lockingBytecode: 'vaultBytecode',
            unlockingBytecode: 'unlockRelease',
            state: { variables: [] },
            actions: [],
            // Vault threads belong to nobody: never count them toward a wallet's balance or use them to fund anything else.
            balance: vaultRoleBalance,
            selectable: false,
            roles: {
                claimant: {
                    actions: [{ action: 'claim', role: 'claimant' }],
                    balance: vaultRoleBalance,
                    selectable: false,
                },
            },
        },
    },
    scripts: {
        // Upstream's v3.2 vault script, verbatim, with its CashScript-style comments.
        vaultBytecode: upstreamTemplate.scripts.lock.script,
        unlockRelease: '<age>',
        // The contract's allowance, which the claim always takes in full: the same integer maths, floor division.
        claimReward: '<age> <claimantCoinSatoshis> OP_MUL <satoshisPerCoin> OP_DIV',
        checkClaim:
            '<age> OP_1 <maximumAge> OP_1ADD OP_WITHIN OP_VERIFY ' +
            'claimReward OP_0 OP_GREATERTHAN OP_VERIFY ' +
            'claimReward <vaultTokenAmount> OP_LESSTHAN OP_VERIFY',
        checkThreadAmount: '<threadTokenAmount> OP_0 OP_GREATERTHAN OP_VERIFY',
    },
    // The contract's hard-coded numbers, for the value expressions above (test/template.test.ts checks they match).
    constants: {
        satoshisPerCoin: {
            name: 'Satoshis per coin',
            description: 'One token per 100,000,000 satoshis (1 BCH) per block.',
            type: 'integer',
            value: 100000000n,
        },
        maximumAge: {
            name: 'Maximum age',
            description: 'The largest age a claim can use, in blocks: 65535, the largest block-based relative timelock.',
            type: 'integer',
            value: 65535n,
        },
        rewardOutputSatoshis: {
            name: 'Reward output satoshis',
            description: 'Satoshis carried by the reward output, as vox.cash/bpt does. They come from the claimant’s coin.',
            type: 'satoshis',
            value: 800n,
        },
    },
    variables: {
        tokenCategory: {
            name: 'Token category',
            description: 'The category of the vault thread’s token (BPTS on vox.cash/bpt), as hex.',
            type: 'token_category',
        },
        threadTokenAmount: {
            name: 'Tokens to deposit',
            description: 'How many tokens the new thread holds.',
            type: 'token_amount',
        },
        threadSatoshis: {
            name: 'Thread satoshis',
            description: 'Satoshis the new thread holds (about 800). A claimer could take part of them: the contract does not check them.',
            type: 'satoshis',
        },
        vaultTokenAmount: {
            name: 'Thread token amount',
            description: 'How many tokens the vault thread being claimed from holds now.',
            type: 'token_amount',
        },
        vaultSatoshis: {
            name: 'Thread satoshis',
            description: 'The satoshis in the vault thread being claimed from.',
            type: 'satoshis',
        },
        claimantCoinSatoshis: {
            name: 'Your coin’s value',
            description: 'The value in satoshis of the coin you claim with. The contract reads it from input 0.',
            type: 'satoshis',
        },
        age: {
            name: 'Age in blocks',
            description: 'Blocks since the younger of your coin and the vault thread was mined, from 1 to 65535.',
            type: 'integer',
        },
        rewardLockingScript: {
            name: 'Reward address',
            description: 'The token-aware locking script that receives the claimed tokens.',
            type: 'locking_script',
        },
    },
};

export { blockPointsTemplate };
