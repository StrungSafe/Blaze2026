/**
 * Revenue Split: an XO template for templates/revenue-split/RevenueSplit.cash.
 *
 * A payer locks satoshis to the RevenueSplit contract. Later, anyone can trigger the payout, which sends the whole
 * coin to three fixed P2PKH recipients at fixed basis points. The triggerer pays the miner fee from their own coins.
 *
 *     redeem script   <collaboratorBasisPoints> <artistBasisPoints> <platformPublicKeyHash>
 *                     <collaboratorPublicKeyHash> <artistPublicKeyHash> revenueSplitBytecode
 *     unlocking       (empty: Payout takes no arguments and is the only function, so there is no selector)
 *
 * CashScript pushes constructor arguments in reverse order, so the first parameter ends up on top of the stack.
 * test/template.test.ts proves the compiled lock equals the CashScript contract's P2SH32 lock.
 *
 * The contract bytecode is read from the committed cashc artifact, so it can never drift from RevenueSplit.cash.
 * Run `npm run template:json` after any change to regenerate template.json, the canonical file that gets published.
 */
import artifact from './artifact/RevenueSplit.json' with { type: 'json' };
import { artifactAsmToCashAssembly } from '../shared/cashscript.js';

const contractParameters = [
    'artistPublicKeyHash',
    'collaboratorPublicKeyHash',
    'platformPublicKeyHash',
    'artistBasisPoints',
    'collaboratorBasisPoints',
];

const revenueSplitTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Revenue Split',
    description:
        'Lock satoshis so they can only be paid out to three fixed recipients (artist, collaborator, platform) at fixed percentages. Anyone can trigger the payout and pays its fee.',
    icon: 'split',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    resources: [
        {
            name: 'Original RevenueSplit draft',
            description: 'The draft contract by angelnath that this template finishes (XOGrid commit 8267aec).',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/blob/8267aec7042fac07662ec5b2e765643d834fa127/contracts/RevenueSplit.cash',
        },
        {
            name: 'RevenueSplit contract and tests',
            description: 'The finished CashScript contract (cashc 0.14.0), its artifact, this template and its tests.',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/tree/main/templates/revenue-split',
        },
    ],
    roles: {
        payer: {
            name: 'Payer',
            description: 'Funds a split, for example a listener paying for music. Chooses nothing about where the money goes beyond the split it pays into.',
            icon: 'sender',
        },
        trigger: {
            name: 'Trigger',
            description: 'Anyone who pays out a split. The trigger cannot keep any of it and pays the miner fee from their own coins.',
            icon: 'split',
        },
    },
    start: [
        {
            action: 'fundSplit',
            role: 'payer',
        },
    ],
    actions: {
        fundSplit: {
            name: 'Fund split',
            description: 'Lock $(<splitSatoshis>) satoshis so they can only be paid out to the three recipients.',
            icon: 'send',
            roles: {
                payer: {
                    name: 'Fund split',
                    description: 'Provide the amount and the split: three recipient key hashes and the artist and collaborator basis points.',
                    icon: 'send',
                    requirements: {
                        variables: ['splitSatoshis', ...contractParameters],
                    },
                },
            },
            requirements: {
                participants: [
                    {
                        role: 'payer',
                        slots: { min: 1, max: 1 },
                    },
                ],
            },
            transaction: 'fundSplitTransaction',
        },
        payout: {
            name: 'Pay out split',
            description:
                'Send a split coin to its artist, collaborator and platform. Each share must be at least the dust limit (546 satoshis), or the network will not relay the payout.',
            icon: 'split',
            roles: {
                trigger: {
                    name: 'Pay out split',
                    description: 'Provide the split coin, its value and its parameters. Your own coins pay the miner fee.',
                    icon: 'split',
                    requirements: {
                        variables: ['splitSatoshis', ...contractParameters],
                    },
                },
            },
            requirements: {
                participants: [
                    {
                        role: 'trigger',
                        slots: { min: 1, max: 1 },
                    },
                ],
            },
            transaction: 'payoutTransaction',
        },
    },
    transactions: {
        fundSplitTransaction: {
            name: 'Split funded',
            description: '$(<splitSatoshis>) satoshis were locked to a revenue split.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'splitOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        payoutTransaction: {
            name: 'Split paid out',
            description: '$(<splitSatoshis>) satoshis were paid out to the artist, collaborator and platform.',
            icon: 'split',
            // The contract finds its shares at the outputs starting at its own input index. This template always puts
            // the split coin at input 0, so the shares are outputs 0, 1 and 2. The trigger's fee input and change follow.
            inputs: [{ input: 'splitInput', inputIndex: 0 }],
            outputs: [
                { output: 'artistShareOutput', outputIndex: 0 },
                { output: 'collaboratorShareOutput', outputIndex: 1 },
                { output: 'platformShareOutput', outputIndex: 2 },
            ],
            version: 2,
            locktime: 0,
            composable: true,
        },
    },
    outputs: {
        splitOutput: {
            name: 'Revenue split',
            description: 'Satoshis that can only be paid out to the three recipients of this split.',
            icon: 'split',
            lockingScript: 'revenueSplitLockingScript',
            // checkSplitParameters fails to compile for parameters that would lock the coin forever, so the engine
            // refuses to build the funding output. The result of the evaluation is just <splitSatoshis>.
            valueSatoshis: '$(checkSplitParameters <splitSatoshis>)',
            token: null,
        },
        artistShareOutput: {
            name: 'Artist share',
            description: '$(artistShare) satoshis paid to the artist.',
            icon: 'receive',
            lockingScript: 'artistLockingScript',
            valueSatoshis: '$(artistShare)',
            token: null,
        },
        collaboratorShareOutput: {
            name: 'Collaborator share',
            description: '$(collaboratorShare) satoshis paid to the collaborator.',
            icon: 'receive',
            lockingScript: 'collaboratorLockingScript',
            valueSatoshis: '$(collaboratorShare)',
            token: null,
        },
        platformShareOutput: {
            name: 'Platform share',
            description: '$(platformShare) satoshis paid to the platform, including any rounding remainder.',
            icon: 'receive',
            lockingScript: 'platformLockingScript',
            valueSatoshis: '$(platformShare)',
            token: null,
        },
    },
    inputs: {
        splitInput: {
            name: 'Split coin',
            description: 'The revenue split coin being paid out.',
            icon: 'split',
            valueSatoshis: '$(<splitSatoshis>)',
            token: null,
            unlockingScript: 'unlockPayout',
        },
    },
    lockingScripts: {
        revenueSplitLockingScript: {
            name: 'Revenue split',
            description: 'The RevenueSplit contract: pays the whole coin to three fixed recipients at fixed basis points.',
            icon: 'split',
            lockingType: 'p2sh',
            lockingBytecode: 'revenueSplitRedeem',
            unlockingBytecode: 'unlockPayout',
            state: {
                variables: contractParameters,
            },
            actions: [],
            // The coin belongs to the recipients, not to the wallet that tracks it, so it never counts toward that
            // wallet's balance and is never picked to fund other transactions.
            balance: {
                satoshis: 0n,
            },
            selectable: false,
            roles: {
                trigger: {
                    state: {
                        variables: contractParameters,
                    },
                    actions: [
                        {
                            action: 'payout',
                            role: 'trigger',
                        },
                    ],
                    balance: {
                        satoshis: 0n,
                    },
                    selectable: false,
                },
            },
        },
        artistLockingScript: {
            name: 'Artist',
            description: 'The artist P2PKH address of this split.',
            icon: 'receive',
            lockingType: 'p2s',
            lockingBytecode: 'artistLockingBytecode',
        },
        collaboratorLockingScript: {
            name: 'Collaborator',
            description: 'The collaborator P2PKH address of this split.',
            icon: 'receive',
            lockingType: 'p2s',
            lockingBytecode: 'collaboratorLockingBytecode',
        },
        platformLockingScript: {
            name: 'Platform',
            description: 'The platform P2PKH address of this split.',
            icon: 'receive',
            lockingType: 'p2s',
            lockingBytecode: 'platformLockingBytecode',
        },
    },
    scripts: {
        revenueSplitBytecode: artifactAsmToCashAssembly(artifact.bytecode),
        revenueSplitRedeem:
            '<collaboratorBasisPoints> <artistBasisPoints> <platformPublicKeyHash> <collaboratorPublicKeyHash> <artistPublicKeyHash> revenueSplitBytecode',
        unlockPayout: '',
        artistLockingBytecode: 'OP_DUP OP_HASH160 <artistPublicKeyHash> OP_EQUALVERIFY OP_CHECKSIG',
        collaboratorLockingBytecode: 'OP_DUP OP_HASH160 <collaboratorPublicKeyHash> OP_EQUALVERIFY OP_CHECKSIG',
        platformLockingBytecode: 'OP_DUP OP_HASH160 <platformPublicKeyHash> OP_EQUALVERIFY OP_CHECKSIG',
        // Same integer maths as RevenueSplit.Payout(), so every output value matches what the contract requires.
        artistShare: '<splitSatoshis> <artistBasisPoints> OP_MUL <basisPointsTotal> OP_DIV',
        collaboratorShare: '<splitSatoshis> <collaboratorBasisPoints> OP_MUL <basisPointsTotal> OP_DIV',
        platformShare: '<splitSatoshis> artistShare OP_SUB collaboratorShare OP_SUB',
        // Fails (so the engine refuses to build the funding output) when the parameters would lock the coin forever:
        // a negative basis point value, basis points summing to more than 10000, or a key hash that is not 20 bytes.
        checkSplitParameters:
            '<artistBasisPoints> OP_0 OP_GREATERTHANOREQUAL OP_VERIFY ' +
            '<collaboratorBasisPoints> OP_0 OP_GREATERTHANOREQUAL OP_VERIFY ' +
            '<artistBasisPoints> <collaboratorBasisPoints> OP_ADD <basisPointsTotal> OP_LESSTHANOREQUAL OP_VERIFY ' +
            '<artistPublicKeyHash> checkKeyHashSize <collaboratorPublicKeyHash> checkKeyHashSize <platformPublicKeyHash> checkKeyHashSize',
        // A key hash must be 20 bytes. In value expressions, engine 0.1.1-next pushes a `bytes` variable as the UTF-8 text
        // of its hex (40 bytes), while locking scripts receive the decoded 20 bytes. Accepting 20 or 40 keeps this
        // check correct under both encodings. See README.md, "XO engine notes".
        checkKeyHashSize: 'OP_SIZE OP_NIP OP_DUP <20> OP_NUMEQUAL OP_SWAP <40> OP_NUMEQUAL OP_BOOLOR OP_VERIFY',
    },
    constants: {
        basisPointsTotal: {
            name: 'Basis points in 100%',
            description: 'Shares are expressed in basis points: 10000 is 100%.',
            type: 'integer',
            value: 10000,
        },
    },
    variables: {
        splitSatoshis: {
            name: 'Split amount',
            description: 'The satoshis in the split coin.',
            type: 'satoshis',
        },
        artistPublicKeyHash: {
            name: 'Artist key hash',
            description: 'The 20-byte public key hash of the artist P2PKH address, as hex.',
            type: 'bytes',
        },
        collaboratorPublicKeyHash: {
            name: 'Collaborator key hash',
            description: 'The 20-byte public key hash of the collaborator P2PKH address, as hex.',
            type: 'bytes',
        },
        platformPublicKeyHash: {
            name: 'Platform key hash',
            description: 'The 20-byte public key hash of the platform P2PKH address, as hex.',
            type: 'bytes',
        },
        artistBasisPoints: {
            name: 'Artist share',
            description: 'The artist share in basis points (100 = 1%).',
            type: 'integer',
        },
        collaboratorBasisPoints: {
            name: 'Collaborator share',
            description: 'The collaborator share in basis points (100 = 1%). The platform receives the rest.',
            type: 'integer',
        },
    },
};

export { revenueSplitTemplate };
