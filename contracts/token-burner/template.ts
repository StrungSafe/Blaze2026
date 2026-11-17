/**
 * Token Burner: an XO template for the TokenBurner contract by Dagur Valberg Johannsson
 * (https://gitlab.com/dagurval/contract-burner, MIT per its README), the contract behind https://www.tokenburner.cash/.
 *
 * Anyone can send CashTokens to the burner address. Anyone can then spend burner coins in a transaction whose only
 * output is a token-free OP_RETURN, which destroys the tokens. The coin's satoshis go to miners as the fee.
 *
 *     redeem script   burnerBytecode   (no constructor parameters)
 *     unlocking       (empty: burn() takes no arguments and is the only function, so there is no selector)
 *
 * The contract is used exactly as deployed, so this template's address is the same address tokenburner.cash shows:
 * bitcoincash:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlc2s5qtune (test/template.test.ts checks this).
 *
 * Run `npm run template:json` after any change to regenerate template.json.
 */
import artifactJson from './artifact/Burner.json' with { type: 'json' };
import { artifactAsmToCashAssembly } from '../shared/cashscript.js';

const burnerRole = {
    actions: [{ action: 'burn', role: 'burner' }],
    // Burner coins belong to nobody: never count them toward a wallet's balance or use them to fund anything else.
    balance: { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 as const },
    selectable: false,
};

const tokenBurnerTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Token Burner',
    description:
        'Provably burn CashTokens. Send tokens to the shared TokenBurner address, then anyone can destroy them in a transaction whose only output is an OP_RETURN farewell message. Burns are final; the satoshis sent with the tokens go to miners.',
    icon: 'burn',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    resources: [
        {
            name: 'Original TokenBurner contract',
            description: 'burner.cash by Dagur Valberg Johannsson (MIT, per the repository README), compiled with cashc 0.9.3. This template uses it unchanged.',
            url: 'https://gitlab.com/dagurval/contract-burner/-/blob/f20240756800e07c091f35e0227967e7db8727d3/burner.cash',
        },
        {
            name: 'tokenburner.cash',
            description: 'The original web app for this burner address, with a feed of recent burns.',
            url: 'https://www.tokenburner.cash/',
        },
        {
            name: 'Template, artifact and tests',
            description: 'This template, the rebuilt artifact and the tests that tie it to the live address.',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/tree/main/contracts/token-burner',
        },
    ],
    roles: {
        depositor: {
            name: 'Depositor',
            description: 'Sends tokens to the burner address so they can be destroyed.',
            icon: 'sender',
        },
        burner: {
            name: 'Burner',
            description: 'Anyone who destroys the tokens waiting at the burner address. The burner cannot keep anything.',
            icon: 'burn',
        },
    },
    start: [
        { action: 'depositFungibleTokens', role: 'depositor' },
        { action: 'depositNonfungibleToken', role: 'depositor' },
        { action: 'depositSatoshis', role: 'depositor' },
        // Any wallet can start a burn, but the engine can only spend burner coins it already tracks: XO 0.1.1-next
        // starts watching the burner address only after this wallet has sent something to it.
        { action: 'burn', role: 'burner' },
    ],
    actions: {
        depositFungibleTokens: {
            name: 'Send fungible tokens to the burner',
            description: 'Send $(<tokenAmount>) tokens of category $(<tokenCategory>) to the burner address. Anyone can then burn them, and nobody can get them back.',
            icon: 'send',
            roles: {
                depositor: {
                    name: 'Send tokens to the burner',
                    description: 'Choose the token category and amount, and the satoshis that travel with them (they become the burn fee).',
                    icon: 'send',
                    requirements: { variables: ['tokenCategory', 'tokenAmount', 'depositSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'depositor', slots: { min: 1, max: 1 } }] },
            transaction: 'depositFungibleTransaction',
        },
        depositNonfungibleToken: {
            name: 'Send an NFT to the burner',
            description: 'Send one NFT of category $(<tokenCategory>) to the burner address. Anyone can then burn it, and nobody can get it back.',
            icon: 'send',
            roles: {
                depositor: {
                    name: 'Send an NFT to the burner',
                    description: 'Choose the NFT (category, capability, commitment) and the satoshis that travel with it (they become the burn fee).',
                    icon: 'send',
                    requirements: { variables: ['tokenCategory', 'tokenCapability', 'tokenCommitment', 'depositSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'depositor', slots: { min: 1, max: 1 } }] },
            transaction: 'depositNonfungibleTransaction',
        },
        depositSatoshis: {
            name: 'Send BCH to the burner (a gift to miners)',
            description:
                'Send $(<depositSatoshis>) satoshis to the burner address. This is not a burn of the BCH: whoever burns the coin next spends it into an OP_RETURN carrying 0 satoshis, so the whole amount becomes the transaction fee and goes to the miner.',
            icon: 'send',
            roles: {
                depositor: {
                    name: 'Send BCH to the burner',
                    description: 'Choose how many satoshis to send. They will go to a miner as a fee when the burner is next swept.',
                    icon: 'send',
                    requirements: { variables: ['depositSatoshis'] },
                },
            },
            requirements: { participants: [{ role: 'depositor', slots: { min: 1, max: 1 } }] },
            transaction: 'depositSatoshisTransaction',
        },
        burn: {
            name: 'Burn',
            description:
                'Destroy the tokens in burner coins. The transaction has exactly one output, an OP_RETURN with your farewell message (up to 220 bytes), so the tokens are gone for good and the coins’ satoshis go to miners. Your wallet can only see burner coins after it has sent something to the burner address itself.',
            icon: 'burn',
            roles: {
                burner: {
                    name: 'Burn',
                    description: 'Pick one or more burner coins and write a farewell message (it can be empty).',
                    icon: 'burn',
                    requirements: { variables: ['burnMessage'] },
                },
            },
            requirements: { participants: [{ role: 'burner', slots: { min: 1, max: 1 } }] },
            transaction: 'burnTransaction',
        },
    },
    transactions: {
        depositFungibleTransaction: {
            name: 'Tokens sent to the burner',
            description: '$(<tokenAmount>) tokens of category $(<tokenCategory>) were sent to the burner.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'burnerFungibleOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        depositNonfungibleTransaction: {
            name: 'NFT sent to the burner',
            description: 'An NFT of category $(<tokenCategory>) was sent to the burner.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'burnerNonfungibleOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        depositSatoshisTransaction: {
            name: 'BCH sent to the burner',
            description: '$(<depositSatoshis>) satoshis were sent to the burner; they go to a miner when the burner is next swept.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'burnerSatoshisOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        burnTransaction: {
            name: 'Tokens burned',
            description: 'Tokens were burned with the farewell message: $(<burnMessage>)',
            icon: 'burn',
            inputs: [{ input: 'burnerInput' }],
            // The contract requires exactly one output, at index 0, an OP_RETURN with no token. Nothing may be added:
            // no change, no other contracts' outputs.
            outputs: [{ output: 'farewellOutput', outputIndex: 0 }],
            version: 2,
            locktime: 0,
            composable: false,
        },
    },
    outputs: {
        burnerFungibleOutput: {
            name: 'Tokens awaiting burn',
            description: '$(<tokenAmount>) tokens of category $(<tokenCategory>) at the burner address.',
            icon: 'burn',
            lockingScript: 'burnerLockingScript',
            valueSatoshis: '$(<depositSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                amount: '$(<tokenAmount>)',
                nft: null,
            },
        },
        burnerSatoshisOutput: {
            name: 'BCH awaiting the next burn',
            description: '$(<depositSatoshis>) satoshis at the burner address, a gift to whichever miner mines the next burn.',
            icon: 'burn',
            lockingScript: 'burnerLockingScript',
            valueSatoshis: '$(<depositSatoshis>)',
            token: null,
        },
        burnerNonfungibleOutput: {
            name: 'NFT awaiting burn',
            description: 'An NFT of category $(<tokenCategory>) at the burner address.',
            icon: 'burn',
            lockingScript: 'burnerLockingScript',
            valueSatoshis: '$(<depositSatoshis>)',
            token: {
                category: '$(<tokenCategory>)',
                amount: null,
                nft: {
                    capability: '$(<tokenCapability>)',
                    commitment: '$(<tokenCommitment>)',
                },
            },
        },
        farewellOutput: {
            name: 'Farewell message',
            description: 'The OP_RETURN that marks the burn: $(<burnMessage>)',
            icon: 'burn',
            lockingScript: 'farewellLockingScript',
            valueSatoshis: 0n,
            token: null,
        },
    },
    inputs: {
        burnerInput: {
            name: 'Burner coin',
            description: 'A coin at the burner address. Its tokens are destroyed and its satoshis go to miners.',
            icon: 'burn',
            unlockingScript: 'unlockBurn',
            // Nothing from this input comes back as change: the tokens are destroyed and the satoshis pay the fee.
            omitChangeAmounts: { satoshis: true, fungibleTokens: true, nonfungibleTokens: true },
        },
    },
    lockingScripts: {
        burnerLockingScript: {
            name: 'TokenBurner',
            description: 'The shared TokenBurner address. Anything sent here can only ever be burned.',
            icon: 'burn',
            lockingType: 'p2sh',
            lockingBytecode: 'burnerBytecode',
            unlockingBytecode: 'unlockBurn',
            state: { variables: [] },
            actions: [],
            balance: burnerRole.balance,
            selectable: false,
            roles: {
                burner: burnerRole,
            },
        },
        farewellLockingScript: {
            name: 'Farewell message',
            description: 'An OP_RETURN carrying the farewell message. It holds no value and can never be spent.',
            icon: 'burn',
            lockingType: 'p2s',
            lockingBytecode: 'farewellBytecode',
        },
    },
    scripts: {
        burnerBytecode: artifactAsmToCashAssembly(artifactJson.bytecode),
        unlockBurn: '',
        farewellBytecode: 'OP_RETURN <burnMessage>',
    },
    constants: {},
    variables: {
        tokenCategory: {
            name: 'Token category',
            description: 'The 32-byte category ID of the tokens to burn, as hex.',
            type: 'token_category',
        },
        tokenAmount: {
            name: 'Token amount',
            description: 'How many fungible tokens to burn.',
            type: 'token_amount',
        },
        tokenCapability: {
            name: 'NFT capability',
            description: 'The capability of the NFT to burn: none, mutable or minting.',
            type: 'token_capability',
        },
        tokenCommitment: {
            name: 'NFT commitment',
            description: 'The commitment of the NFT to burn, as hex (empty for none).',
            type: 'token_commitment',
        },
        depositSatoshis: {
            name: 'Satoshis with the tokens',
            description:
                'Satoshis sent to the burner address, alone or with tokens (a token output needs about 1000). They become the fee of the next burn and go to a miner; they are not destroyed.',
            type: 'satoshis',
        },
        burnMessage: {
            name: 'Farewell message',
            description: 'Text written into the burn’s OP_RETURN, up to 220 bytes. It can be empty.',
            type: 'string',
        },
    },
};

export { tokenBurnerTemplate };
