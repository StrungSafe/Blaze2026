/**
 * Claim-Code Voucher: an original XO template written for this hub.
 *
 * The issuer locks satoshis to the SHA-256 hash of a secret claim code. Anyone who knows the code can claim the funds
 * by revealing it, so value can be handed over as a code instead of an address. The locking script is a P2SH hash lock:
 *
 *     redeem script   OP_SHA256 <codeHash> OP_EQUAL
 *     unlocking       <claimCode> <redeem script>
 *
 * Limits worth knowing: the code becomes public when the claim transaction is broadcast, so a code works exactly once,
 * and anyone who sees the claim in the mempool before it confirms could race it. Keep voucher amounts small.
 */

const claimVoucherTemplate = {
    $schema: 'https://libauth.org/schemas/wallet-template-v0.schema.json',
    name: 'Claim-Code Voucher',
    description:
        'Lock satoshis to the hash of a secret code. Whoever knows the code can claim the funds, so value can be handed over as a code instead of an address.',
    icon: 'voucher',
    version: '1',
    supported: ['BCH_2023_05', 'BCH_2024_05', 'BCH_2025_05', 'BCH_2026_05'],
    defaults: {
        receive: {
            output: 'voucherOutput',
            role: 'claimer',
        },
    },
    roles: {
        issuer: {
            name: 'Issuer',
            description: 'The party who funds the voucher and chooses the claim code.',
            icon: 'sender',
        },
        claimer: {
            name: 'Claimer',
            description: 'The party who knows the claim code and collects the funds.',
            icon: 'receiver',
        },
    },
    start: [
        {
            action: 'createVoucher',
            role: 'issuer',
        },
    ],
    actions: {
        createVoucher: {
            name: 'Create voucher',
            description: 'Lock satoshis so that whoever knows the claim code can collect them.',
            icon: 'send',
            roles: {
                issuer: {
                    name: 'Create voucher',
                    description: 'Provide the amount and the hash of the claim code.',
                    icon: 'send',
                    requirements: {
                        variables: ['voucherSatoshis', 'codeHash'],
                    },
                },
            },
            requirements: {
                participants: [
                    {
                        role: 'issuer',
                        slots: { min: 1, max: 1 },
                    },
                ],
            },
            transaction: 'createVoucherTransaction',
        },
        claimVoucher: {
            name: 'Claim voucher',
            description: 'Reveal the claim code to collect the funds locked in a voucher.',
            icon: 'receive',
            roles: {
                claimer: {
                    name: 'Claim voucher',
                    description: 'Provide the claim code.',
                    icon: 'receive',
                    requirements: {
                        variables: ['claimCode'],
                    },
                },
            },
            requirements: {
                participants: [
                    {
                        role: 'claimer',
                        slots: { min: 1, max: 1 },
                    },
                ],
            },
            transaction: 'claimVoucherTransaction',
        },
    },
    transactions: {
        createVoucherTransaction: {
            name: 'Voucher created',
            description: '$(<voucherSatoshis>) satoshis were locked to a claim code.',
            icon: 'send',
            inputs: [],
            outputs: [{ output: 'voucherOutput' }],
            version: 2,
            locktime: 0,
            composable: true,
        },
        claimVoucherTransaction: {
            name: 'Voucher claimed',
            description: 'A voucher was claimed by revealing its claim code.',
            icon: 'receive',
            inputs: [{ input: 'voucherInput' }],
            outputs: [],
            version: 2,
            locktime: 0,
            composable: true,
        },
    },
    outputs: {
        voucherOutput: {
            name: 'Voucher',
            description: 'Funds locked to the hash of a claim code.',
            icon: 'voucher',
            lockingScript: 'voucherLockingScript',
            valueSatoshis: '$(<voucherSatoshis>)',
            token: null,
        },
    },
    inputs: {
        voucherInput: {
            name: 'Voucher claim',
            description: 'Spends a voucher by revealing its claim code.',
            icon: 'receive',
            unlockingScript: 'unlockVoucher',
        },
    },
    lockingScripts: {
        voucherLockingScript: {
            name: 'Voucher',
            description: 'Funds that anyone who knows the claim code can collect.',
            icon: 'voucher',
            lockingType: 'p2sh',
            lockingBytecode: 'voucherRedeemBytecode',
            unlockingBytecode: 'unlockVoucher',
            state: {
                variables: ['codeHash'],
            },
            actions: [],
            roles: {
                claimer: {
                    state: {
                        variables: ['codeHash'],
                    },
                    actions: [
                        {
                            action: 'claimVoucher',
                            role: 'claimer',
                        },
                    ],
                    balance: {
                        satoshis: true,
                    },
                    selectable: true,
                },
            },
        },
    },
    scripts: {
        voucherRedeemBytecode: 'OP_SHA256 <codeHash> OP_EQUAL',
        unlockVoucher: '<claimCode>',
    },
    constants: {},
    variables: {
        voucherSatoshis: {
            name: 'Voucher amount',
            description: 'The satoshis locked in the voucher.',
            type: 'satoshis',
        },
        codeHash: {
            name: 'Claim code hash',
            description: 'The SHA-256 hash of the claim code, 32 bytes.',
            type: 'bytes',
        },
        claimCode: {
            name: 'Claim code',
            description: 'The secret code whose SHA-256 hash locks the voucher. It becomes public when the claim is broadcast.',
            type: 'bytes',
        },
    },
};

export { claimVoucherTemplate };
