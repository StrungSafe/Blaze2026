/**
 * Badgers Stake: an XO template for BadgerStake by SayoshiNakamario (https://github.com/SayoshiNakamario/BadgersStake),
 * the staking contract behind https://badgers.cash.
 *
 * Stakers lock BCH in the contract for a number of blocks and earn BadgerCoins (one per BCH per block); when the lock
 * ends, anyone can release the BCH, the BadgerCoins and a "Honey" NFT receipt to the staker. A "masterBadger" minting
 * NFT, held by the contract, carries the BadgerCoin supply, the staking fee and the admin's key hash.
 *
 *     redeem script   badgerBytecode   (no constructor parameters; the masterBadger category is hard-coded)
 *     unlocking       lock:     <pubkeyhash> <stakeBlocks> <amount> <0>
 *                     unlock:   <1>
 *                     withdraw: <newFee> <2>
 *
 * The contract is used exactly as deployed, so this template's address is the badgers.cash contract address
 * (test/template.test.ts checks this). The category the bytecode hard-codes (in internal byte order) is repeated as the
 * `badgerCategory` constant (display order) for the token fields; a test checks the two agree. Constants can't be used
 * in the redeem script itself: the engine's script compiler only knows template variables.
 *
 * Token fields (category, amount, NFT commitment) are evaluated by the engine as text: a string variable is pushed as
 * its UTF-8 text and the result is read back as hex. The commitments here are therefore built as hex text, with the
 * hex* helper scripts below converting numbers. test/template.test.ts checks every one against the contract's bytes.
 *
 * Run `npm run template:json` after any change to regenerate template.json.
 */
import artifactJson from './artifact/BadgerStake.json' with { type: 'json' };
import { artifactAsmToCashAssembly } from '../shared/cashscript.js';

/** 18 zero bytes, as hex text: the padding inside the masterBadger and lock NFT commitments. */
const PADDING_TEXT = `'${'00'.repeat(18)}'`;

const noBalance = { satoshis: 0n, fungibleTokens: 0n, nonfungibleTokens: 0 as const };

const badgersStakeTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Badgers Stake',
    description:
        'Stake BCH to earn BadgerCoins. Lock BCH in the BadgerStake contract for a number of blocks and earn one BadgerCoin per BCH per block; when the lock ends, the BCH, the BadgerCoins and a Honey NFT receipt go back to your address.',
    icon: 'stake',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    resources: [
        {
            name: 'Original BadgerStake contract',
            description: 'BadgerStake.cash by SayoshiNakamario, compiled with cashc 0.10.0-next.4. This template uses it unchanged. The repository has no licence file.',
            url: 'https://github.com/SayoshiNakamario/BadgersStake/blob/49ccba8d1726d73919b584e1aa7ec5c63eea5479/BadgerStake.cash',
        },
        {
            name: 'badgers.cash',
            description: 'The BadgersStake web app.',
            url: 'https://badgers.cash',
        },
        {
            name: 'Template, artifact and tests',
            description: 'This template, the rebuilt artifact and the tests that tie it to the live contract.',
            url: 'https://github.com/XOGrid-Cash/Blaze2026_XOGrid/tree/main/templates/badgers-stake',
        },
    ],
    roles: {
        staker: {
            name: 'Staker',
            description: 'Locks BCH to earn BadgerCoins. Anyone can release a finished lock, but the payout always goes to the staker.',
            icon: 'stake',
        },
        admin: {
            name: 'Admin',
            description: 'Holds the key whose hash is in the masterBadger commitment: collects the staking fees and sets the fee.',
            icon: 'admin',
        },
    },
    start: [
        { action: 'stake', role: 'staker' },
        { action: 'unstake', role: 'staker' },
        { action: 'withdraw', role: 'admin' },
        { action: 'deploy', role: 'admin' },
    ],
    actions: {
        deploy: {
            name: 'Deploy a masterBadger',
            description:
                'Move a masterBadger (a minting NFT of category $(<badgerCategory>) carrying $(<masterTokenAmount>) BadgerCoins) into the BadgerStake contract, with a staking fee of $(<newStakeFee>) satoshis.',
            icon: 'admin',
            roles: {
                admin: {
                    name: 'Deploy',
                    description: 'Pick the minting NFT; it moves into the contract with your key hash as admin. Only the category in this template can be staked against.',
                    icon: 'admin',
                    requirements: { variables: ['masterSatoshis', 'masterTokenAmount', 'newStakeFee', 'adminPublicKeyHash'] },
                },
            },
            requirements: { participants: [{ role: 'admin', slots: { min: 1, max: 1 } }] },
            transaction: 'deployTransaction',
        },
        stake: {
            name: 'Stake BCH',
            description: 'Lock $(<stakeSatoshis>) satoshis for $(<stakeBlocks>) blocks and earn $(stakeReward) BadgerCoins, paying a staking fee of $(stakeFee) satoshis.',
            icon: 'stake',
            roles: {
                staker: {
                    name: 'Stake',
                    description:
                        'Pick one plain BCH coin at a P2PKH address of yours (its key hash is your payout address), the amount to lock (at least 5000 sats) and the number of blocks (up to 32767). The reward is amount × blocks / 100,000,000.',
                    icon: 'stake',
                    requirements: {
                        variables: ['masterSatoshis', 'masterTokenAmount', 'masterCommitment', 'stakeSatoshis', 'stakeBlocks', 'stakerPublicKeyHash', 'stakerCoinSatoshis'],
                    },
                },
            },
            requirements: { participants: [{ role: 'staker', slots: { min: 1, max: 1 } }] },
            transaction: 'stakeTransaction',
        },
        unstake: {
            name: 'Release a finished stake',
            description:
                'Release a lock of $(<lockSatoshis>) satoshis after $(<stakeBlocks>) blocks: $(<lockTokenAmount>) BadgerCoins, a Honey NFT and the BCH (less 3000 sats) go to the staker’s address.',
            icon: 'stake',
            roles: {
                staker: {
                    name: 'Release',
                    description: 'Pick a lock whose period has passed. Anyone can release it; everything goes to the staker who made it.',
                    icon: 'stake',
                    requirements: { variables: ['lockSatoshis', 'lockTokenAmount', 'stakeBlocks', 'stakerPublicKeyHash'] },
                },
            },
            requirements: { participants: [{ role: 'staker', slots: { min: 1, max: 1 } }] },
            transaction: 'unstakeTransaction',
        },
        withdraw: {
            name: 'Withdraw staking fees',
            description: 'Withdraw the masterBadger’s collected fees ($(<masterSatoshis>) satoshis, less 1000 kept and 1000 fee) and set the staking fee to $(<newStakeFee>) satoshis.',
            icon: 'admin',
            roles: {
                admin: {
                    name: 'Withdraw',
                    description: 'Pick one plain BCH coin at the admin address named in the masterBadger commitment, and where the fees go.',
                    icon: 'admin',
                    requirements: { variables: ['masterSatoshis', 'masterTokenAmount', 'masterCommitment', 'newStakeFee', 'adminCoinSatoshis', 'withdrawLockingScript'] },
                },
            },
            requirements: { participants: [{ role: 'admin', slots: { min: 1, max: 1 } }] },
            transaction: 'withdrawTransaction',
        },
    },
    transactions: {
        deployTransaction: {
            name: 'masterBadger deployed',
            description: 'A masterBadger with $(<masterTokenAmount>) BadgerCoins moved into the BadgerStake contract.',
            icon: 'admin',
            inputs: [],
            outputs: [{ output: 'masterDeployOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        // The contract fixes each layout: the contract coin at input 0, exact input and output counts, and the
        // outputs in order. Nothing can be added, so the engine must not add change.
        stakeTransaction: {
            name: 'BCH staked',
            description: '$(<stakeSatoshis>) satoshis locked for $(<stakeBlocks>) blocks, earning $(stakeReward) BadgerCoins.',
            icon: 'stake',
            inputs: [
                { input: 'masterStakeInput', inputIndex: 0 },
                { input: 'stakerCoinInput', inputIndex: 1 },
            ],
            outputs: [
                { output: 'masterAfterStakeOutput', outputIndex: 0 },
                { output: 'lockOutput', outputIndex: 1 },
                { output: 'stakeChangeOutput', outputIndex: 2 },
            ],
            version: 2,
            locktime: 0,
            composable: false,
        },
        unstakeTransaction: {
            name: 'Stake released',
            description: '$(<lockTokenAmount>) BadgerCoins, a Honey NFT and the locked BCH were released to the staker.',
            icon: 'stake',
            inputs: [{ input: 'lockInput', inputIndex: 0 }],
            outputs: [
                { output: 'badgerCoinOutput', outputIndex: 0 },
                { output: 'honeyOutput', outputIndex: 1 },
                { output: 'unstakedOutput', outputIndex: 2 },
            ],
            version: 2,
            locktime: 0,
            composable: false,
        },
        withdrawTransaction: {
            name: 'Staking fees withdrawn',
            description: 'The masterBadger’s fees were withdrawn and the staking fee set to $(<newStakeFee>) satoshis.',
            icon: 'admin',
            inputs: [
                { input: 'masterWithdrawInput', inputIndex: 0 },
                { input: 'adminCoinInput', inputIndex: 1 },
            ],
            outputs: [
                { output: 'masterAfterWithdrawOutput', outputIndex: 0 },
                { output: 'withdrawOutput', outputIndex: 1 },
            ],
            version: 2,
            locktime: 0,
            composable: false,
        },
    },
    outputs: {
        masterDeployOutput: {
            name: 'masterBadger',
            description: 'The masterBadger in the BadgerStake contract, holding $(<masterTokenAmount>) BadgerCoins.',
            icon: 'admin',
            lockingScript: 'badgerLockingScript',
            valueSatoshis: '$(<masterSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<masterTokenAmount>)',
                nft: { capability: 'minting', commitment: '$(checkNewFee deployCommitment)' },
            },
        },
        masterAfterStakeOutput: {
            name: 'masterBadger (after the stake)',
            description: 'The masterBadger with the staking fee added and the reward taken out.',
            icon: 'admin',
            lockingScript: 'badgerLockingScript',
            valueSatoshis: '$(<masterSatoshis> stakeFee OP_ADD)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<masterTokenAmount> stakeReward OP_SUB)',
                nft: { capability: 'minting', commitment: '$(<masterCommitment>)' },
            },
        },
        lockOutput: {
            name: 'Stake lock',
            description: '$(<stakeSatoshis>) satoshis and $(stakeReward) BadgerCoins locked for $(<stakeBlocks>) blocks.',
            icon: 'stake',
            lockingScript: 'badgerLockingScript',
            valueSatoshis: '$(<stakeSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                // checkStake refuses an amount below 5000 sats, a period outside 1-32767 blocks, a reward below 1, and
                // a reward the masterBadger cannot cover.
                amount: '$(checkStake stakeReward)',
                nft: { capability: 'mutable', commitment: '$(lockCommitment)' },
            },
        },
        stakeChangeOutput: {
            name: 'Change',
            description: 'What is left of your coin, back to the same address.',
            icon: 'stake',
            lockingScript: 'stakerLockingScript',
            valueSatoshis: '$(checkStakeChange stakeChange)',
            token: null,
        },
        badgerCoinOutput: {
            name: 'BadgerCoins',
            description: '$(<lockTokenAmount>) BadgerCoins earned by the stake.',
            icon: 'stake',
            lockingScript: 'stakerLockingScript',
            valueSatoshis: '$(<payoutDustSatoshis>)',
            token: { category: '$(<badgerCategory>)', amount: '$(<lockTokenAmount>)', nft: null },
        },
        honeyOutput: {
            name: 'Honey NFT',
            description: 'A receipt NFT recording the $(<lockTokenAmount>) BadgerCoins earned.',
            icon: 'stake',
            lockingScript: 'stakerLockingScript',
            valueSatoshis: '$(<payoutDustSatoshis>)',
            token: { category: '$(<badgerCategory>)', amount: null, nft: { capability: 'none', commitment: '$(honeyCommitment)' } },
        },
        unstakedOutput: {
            name: 'Released BCH',
            description: 'The staked BCH, less 3000 satoshis for the two token outputs and the fee.',
            icon: 'stake',
            lockingScript: 'stakerLockingScript',
            valueSatoshis: '$(<lockSatoshis> <unstakeCostSatoshis> OP_SUB)',
            token: null,
        },
        masterAfterWithdrawOutput: {
            name: 'masterBadger (after the withdrawal)',
            description: 'The masterBadger, left with 1000 satoshis and the new staking fee.',
            icon: 'admin',
            lockingScript: 'badgerLockingScript',
            valueSatoshis: '$(<masterDustSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<masterTokenAmount>)',
                nft: { capability: 'minting', commitment: '$(checkNewFee withdrawCommitment)' },
            },
        },
        withdrawOutput: {
            name: 'Withdrawn fees',
            description: 'The masterBadger’s collected fees plus the admin coin, less 2000 satoshis.',
            icon: 'admin',
            lockingScript: '$(<withdrawLockingScript>)',
            valueSatoshis: '$(<masterSatoshis> <adminCoinSatoshis> OP_ADD <withdrawCostSatoshis> OP_SUB)',
            token: null,
        },
    },
    inputs: {
        masterStakeInput: {
            name: 'masterBadger',
            description: 'The masterBadger, at input 0.',
            icon: 'admin',
            valueSatoshis: '$(<masterSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<masterTokenAmount>)',
                nft: { capability: 'minting', commitment: '$(<masterCommitment>)' },
            },
            unlockingScript: 'unlockStake',
        },
        stakerCoinInput: {
            name: 'Your coin',
            description: 'A plain BCH coin at the P2PKH address of $(<stakerPublicKeyHash>), at input 1. It pays the stake, the fee and the miner; the rest comes back.',
            icon: 'stake',
            valueSatoshis: '$(<stakerCoinSatoshis>)',
            token: null,
        },
        lockInput: {
            name: 'Stake lock',
            description: 'A lock whose $(<stakeBlocks>) blocks have passed.',
            icon: 'stake',
            valueSatoshis: '$(<lockSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<lockTokenAmount>)',
                nft: { capability: 'mutable', commitment: '$(lockCommitment)' },
            },
            // The contract's OP_CHECKSEQUENCEVERIFY (tx.age >= stakeBlocks): a block-based relative timelock.
            sequenceNumber: '$(<stakeBlocks>)',
            unlockingScript: 'unlockUnstake',
        },
        masterWithdrawInput: {
            name: 'masterBadger',
            description: 'The masterBadger, at input 0.',
            icon: 'admin',
            valueSatoshis: '$(<masterSatoshis>)',
            token: {
                category: '$(<badgerCategory>)',
                amount: '$(<masterTokenAmount>)',
                nft: { capability: 'minting', commitment: '$(<masterCommitment>)' },
            },
            unlockingScript: 'unlockWithdraw',
        },
        adminCoinInput: {
            name: 'Admin coin',
            description: 'A plain BCH coin at the admin address in the masterBadger commitment, at input 1. Its signature authorises the withdrawal.',
            icon: 'admin',
            valueSatoshis: '$(<adminCoinSatoshis>)',
            token: null,
        },
    },
    lockingScripts: {
        badgerLockingScript: {
            name: 'BadgerStake',
            description: 'The BadgerStake contract, holding the masterBadger and every stake lock.',
            icon: 'stake',
            lockingType: 'p2sh',
            lockingBytecode: 'badgerBytecode',
            state: { variables: [] },
            actions: [],
            // The masterBadger and the locks are not the wallet's spendable funds.
            balance: noBalance,
            selectable: false,
            roles: {
                staker: {
                    actions: [
                        { action: 'stake', role: 'staker' },
                        { action: 'unstake', role: 'staker' },
                    ],
                    balance: noBalance,
                    selectable: false,
                },
                admin: {
                    actions: [{ action: 'withdraw', role: 'admin' }],
                    balance: noBalance,
                    selectable: false,
                },
            },
        },
        stakerLockingScript: {
            name: 'Staker address',
            description: 'The staker’s P2PKH address. The contract sends change and payouts here, and only here.',
            icon: 'stake',
            lockingType: 'p2s',
            lockingBytecode: 'stakerP2pkhBytecode',
            // Already the wallet's own address under its P2PKH template; not tracked again here.
            roles: { staker: { relevant: false } },
        },
    },
    scripts: {
        // The deployed bytecode, unchanged.
        badgerBytecode: artifactAsmToCashAssembly(artifactJson.bytecode),
        unlockStake: '<stakerPublicKeyHash> <stakeBlocks> <stakeSatoshis> <0>',
        unlockUnstake: '<1>',
        unlockWithdraw: '<newStakeFee> <2>',
        stakerP2pkhBytecode: 'OP_DUP OP_HASH160 <stakerPublicKeyHash> OP_EQUALVERIFY OP_CHECKSIG',

        // The contract's maths, which the template always uses exactly.
        stakeReward: '<stakeSatoshis> <stakeBlocks> OP_MUL <satoshisPerCoin> OP_DIV',
        stakeFee: '<masterCommitment> <4> OP_SPLIT OP_DROP hexTextToUint16LE',
        stakeChange: '<stakerCoinSatoshis> <stakeSatoshis> OP_SUB stakeFee OP_SUB <stakeMinerFeeSatoshis> OP_SUB',

        // Guards: each fails, so the engine refuses to build the output, instead of the contract rejecting the spend.
        checkStake:
            '<stakeSatoshis> <minimumStakeSatoshis> OP_GREATERTHANOREQUAL OP_VERIFY ' +
            '<stakeBlocks> OP_1 <maximumStakeBlocks> OP_1ADD OP_WITHIN OP_VERIFY ' +
            'stakeReward OP_1 OP_GREATERTHANOREQUAL OP_VERIFY ' +
            'stakeReward <masterTokenAmount> OP_LESSTHAN OP_VERIFY',
        checkStakeChange: 'stakeChange <changeDustSatoshis> OP_GREATERTHANOREQUAL OP_VERIFY',
        checkNewFee: '<newStakeFee> OP_0 <maximumStakeFee> OP_1ADD OP_WITHIN OP_VERIFY',

        // Commitments, as hex text (see the file comment).
        lockCommitment: `<stakerPublicKeyHash> <${PADDING_TEXT}> OP_CAT <stakeBlocks> hexUint16LE OP_CAT`,
        honeyCommitment: "<'0000'> <lockTokenAmount> binToHexText OP_CAT",
        deployCommitment: `<newStakeFee> hexUint16LE <${PADDING_TEXT}> OP_CAT <adminPublicKeyHash> OP_CAT`,
        withdrawCommitment: '<newStakeFee> hexUint16LE <masterCommitment> <4> OP_SPLIT OP_NIP OP_CAT',

        // Number to hex text: a nibble (0-15), a byte (0-255), a 2-byte little-endian number (the contract's bytes2),
        // and any byte string (used for a VM number).
        hexNibble: 'OP_DUP <10> OP_LESSTHAN OP_IF <48> OP_ELSE <87> OP_ENDIF OP_ADD <1> OP_NUM2BIN',
        hexByte: 'OP_DUP <16> OP_DIV hexNibble OP_SWAP <16> OP_MOD hexNibble OP_CAT',
        hexUint16LE: 'OP_DUP <256> OP_MOD hexByte OP_SWAP <256> OP_DIV hexByte OP_CAT',
        binToHexText: 'OP_0 OP_SWAP OP_BEGIN OP_1 OP_SPLIT OP_SWAP <0x00> OP_CAT OP_BIN2NUM hexByte OP_ROT OP_SWAP OP_CAT OP_SWAP OP_SIZE OP_0 OP_NUMEQUAL OP_UNTIL OP_DROP',
        // Hex text to number: one hex digit (either case), two digits, four digits read as a little-endian bytes2.
        hexTextNibble: '<0x00> OP_CAT OP_BIN2NUM OP_DUP <97> OP_GREATERTHANOREQUAL OP_IF <87> OP_ELSE OP_DUP <65> OP_GREATERTHANOREQUAL OP_IF <55> OP_ELSE <48> OP_ENDIF OP_ENDIF OP_SUB',
        hexTextByte: 'OP_1 OP_SPLIT OP_SWAP hexTextNibble <16> OP_MUL OP_SWAP hexTextNibble OP_ADD',
        hexTextToUint16LE: '<2> OP_SPLIT hexTextByte <256> OP_MUL OP_SWAP hexTextByte OP_ADD',
    },
    constants: {
        badgerCategory: {
            name: 'masterBadger category',
            description: 'The BadgerCoin token category the contract hard-codes (badgers.cash on mainnet), for the token fields. It must match the bytecode.',
            type: 'token_category',
            value: '242f6ecedb404c743477e35b09733a56cacae34f3109d5cee1cbc1d5630affd7',
        },
        satoshisPerCoin: { name: 'Satoshis per coin', description: 'One BadgerCoin per 100,000,000 satoshis per block.', type: 'integer', value: 100000000n },
        minimumStakeSatoshis: { name: 'Minimum stake', description: 'The smallest amount the contract lets you lock.', type: 'satoshis', value: 5000n },
        maximumStakeBlocks: {
            name: 'Maximum stake period',
            description: 'The longest lock that works: 32767 blocks. The contract allows 65536, but stores the period in 2 bytes, which fails above 32767.',
            type: 'integer',
            value: 32767n,
        },
        maximumStakeFee: { name: 'Maximum staking fee', description: 'The largest fee a 2-byte commitment field holds as a positive number.', type: 'satoshis', value: 32767n },
        payoutDustSatoshis: { name: 'Payout token dust', description: 'Satoshis the contract puts on each payout token output.', type: 'satoshis', value: 1000n },
        unstakeCostSatoshis: { name: 'Release cost', description: 'Taken from the staked BCH on release: two 1000-sat token outputs and a 1000-sat fee.', type: 'satoshis', value: 3000n },
        masterDustSatoshis: { name: 'masterBadger dust', description: 'Satoshis left on the masterBadger after a withdrawal.', type: 'satoshis', value: 1000n },
        withdrawCostSatoshis: { name: 'Withdrawal cost', description: 'Kept back on a withdrawal: 1000 sats left on the masterBadger and a 1000-sat fee.', type: 'satoshis', value: 2000n },
        stakeMinerFeeSatoshis: { name: 'Stake fee to miners', description: 'The miner fee of a stake transaction (about 2 sats per byte of its ~860 bytes).', type: 'satoshis', value: 1700n },
        changeDustSatoshis: { name: 'Change dust limit', description: 'The smallest change a stake may return (the P2PKH dust limit).', type: 'satoshis', value: 546n },
    },
    variables: {
        masterSatoshis: { name: 'masterBadger satoshis', description: 'The satoshis on the masterBadger now (or, when deploying, to put on it).', type: 'satoshis' },
        masterTokenAmount: { name: 'masterBadger BadgerCoins', description: 'The BadgerCoins the masterBadger holds now.', type: 'token_amount' },
        masterCommitment: {
            name: 'masterBadger commitment',
            description: 'The masterBadger’s 40-byte commitment, as hex: the staking fee (2 bytes), padding (18 bytes) and the admin key hash (20 bytes).',
            type: 'token_commitment',
        },
        stakeSatoshis: { name: 'Amount to stake', description: 'Satoshis to lock (at least 5000).', type: 'satoshis' },
        stakeBlocks: { name: 'Lock period', description: 'Blocks the stake stays locked, from 1 to 32767.', type: 'integer' },
        stakerPublicKeyHash: { name: 'Your key hash', description: 'The 20-byte public key hash of the P2PKH address your coin is at, as hex. Payouts go back to it.', type: 'bytes' },
        stakerCoinSatoshis: { name: 'Your coin’s value', description: 'The value in satoshis of the coin you stake from.', type: 'satoshis' },
        lockSatoshis: { name: 'Lock satoshis', description: 'The satoshis in the lock being released.', type: 'satoshis' },
        lockTokenAmount: { name: 'Lock BadgerCoins', description: 'The BadgerCoins the lock holds.', type: 'token_amount' },
        newStakeFee: { name: 'Staking fee', description: 'The fee in satoshis each stake pays the masterBadger, from 0 to 32767.', type: 'satoshis' },
        adminPublicKeyHash: { name: 'Admin key hash', description: 'The 20-byte public key hash of the admin’s P2PKH address, as hex.', type: 'bytes' },
        adminCoinSatoshis: { name: 'Admin coin value', description: 'The value in satoshis of the admin coin used to authorise the withdrawal.', type: 'satoshis' },
        withdrawLockingScript: { name: 'Withdraw to', description: 'The locking script that receives the withdrawn fees.', type: 'locking_script' },
    },
};

export { badgersStakeTemplate };
