/**
 * Runs one complete XO action on CHIPNET (test coins, no real value): fund, send, sign, broadcast.
 * It follows https://stack.xo.cash/getting-started.html with the p2pkh template, optionally fetched from this hub.
 *
 *     HUB_URL=http://localhost:3000 npx tsx scripts/chipnet-send.ts
 *
 * First run: prints a chipnet address and waits for you to fund it from a faucet (tbch.googol.cash or
 * chipnet.bch.ninja). Funds arriving ends the wait and the send runs. The test wallet is kept in .xo-demo/ so later
 * runs reuse the same address and funds. Delete that folder to start fresh. This script refuses any network but chipnet.
 */
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateBip39Mnemonic, hexToBin, lockingBytecodeToCashAddress } from '@bitauth/libauth';
import { DUST_LIMIT_SATOSHIS, getTemplateLockingScriptOrThrow } from '@xo-cash/engine';
import { createChipnetEngine } from './_engine.js';
import { serializeInvitation } from '@xo-cash/utils';
import { p2pkhTemplate } from '@xo-cash/templates';

const HUB_URL = process.env.HUB_URL?.replace(/\/$/, '');
const SEND_SATS = BigInt(process.env.SEND_SATS ?? '5000');
const WAIT_MINUTES = Number(process.env.WAIT_MINUTES ?? '10');
const FOLDER = join(process.cwd(), '.xo-demo');
const MNEMONIC_FILE = join(FOLDER, 'mnemonic.txt');
// p2pkh template identifier under the hub's canonical rule, checked by chipnet-gate.ts.
const P2PKH_IDENTIFIER = 'a31eb85891dbf248f1709a92b0fa7e3e6fdc518e6b34e376b197ed7f12dbc672';

mkdirSync(FOLDER, { recursive: true });

if (!existsSync(MNEMONIC_FILE)) {
    const generated = generateBip39Mnemonic();

    if (typeof generated !== 'string' || generated.split(' ').length < 12) {
        throw new Error('Could not generate a mnemonic.');
    }

    writeFileSync(MNEMONIC_FILE, generated, { mode: 0o600 });
    chmodSync(MNEMONIC_FILE, 0o600);
    console.log(`Created a new chipnet test wallet in ${MNEMONIC_FILE} (keep it out of git; it is test money only).`);
}

const mnemonic = readFileSync(MNEMONIC_FILE, 'utf8').trim();

const engine = await createChipnetEngine(mnemonic, FOLDER);

const bigintSafe = (_key: string, value: unknown): unknown => (typeof value === 'bigint' ? `${value}n` : value instanceof Uint8Array ? Buffer.from(value).toString('hex') : value);

try {
    // Step 2: import the template, from the hub when HUB_URL is set so the identifier travels hub -> engine.
    let source: string | typeof p2pkhTemplate = p2pkhTemplate;

    if (HUB_URL) {
        const response = await fetch(`${HUB_URL}/api/templates/${P2PKH_IDENTIFIER}/raw`);

        if (!response.ok) {
            throw new Error(`Hub returned HTTP ${response.status} for the p2pkh template.`);
        }

        source = await response.text();
        console.log(`Template fetched from the hub by identifier ${P2PKH_IDENTIFIER.slice(0, 12)}...`);
    }

    const { templateIdentifier } = await engine.importTemplate(source);

    if (templateIdentifier !== P2PKH_IDENTIFIER) {
        throw new Error(`Identifier mismatch: engine ${templateIdentifier}, hub rule ${P2PKH_IDENTIFIER}`);
    }

    await engine.setDefaultPolicies({
        change: { templateIdentifier },
        receive: { templateIdentifier },
        address: { templateIdentifier },
    });

    // Step 3: a receive address, and wait for funds if there are none.
    const needed = SEND_SATS + 1000n;
    let spendable = await engine.listSpendableUnspentOutputs();
    let balance = spendable.reduce((sum, output) => sum + BigInt(output.valueSatoshis), 0n);

    if (balance < needed) {
        const fundingBytecode = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
        const fundingAddress = lockingBytecodeToCashAddress({ bytecode: hexToBin(fundingBytecode), prefix: 'bchtest' });

        if (typeof fundingAddress === 'string') {
            throw new Error(fundingAddress);
        }

        console.log(`\nFund this CHIPNET address with at least ${needed} satoshis (0.0001 tBCH is plenty):\n\n    ${fundingAddress.address}\n`);
        console.log('Faucets: https://tbch.googol.cash/  or  https://chipnet.bch.ninja/');
        console.log(`Waiting up to ${WAIT_MINUTES} minutes for the coins to arrive...`);

        const deadline = Date.now() + WAIT_MINUTES * 60_000;

        while (balance < needed && Date.now() < deadline) {
            await new Promise((resolve) => setTimeout(resolve, 5000));
            spendable = await engine.listSpendableUnspentOutputs();
            balance = spendable.reduce((sum, output) => sum + BigInt(output.valueSatoshis), 0n);
        }

        if (balance < needed) {
            console.log('\nNo funds yet. Fund the address above, then run this command again (the wallet is kept).');
            process.exitCode = 2;
            throw new Error('stopped: waiting for funds');
        }
    }

    console.log(`Funded: ${balance} satoshis spendable on chipnet.`);

    const [fundedOutput] = spendable;

    if (!fundedOutput) {
        throw new Error('No spendable output.');
    }

    // Step 4: find the sendSatoshis intent on the receiving locking script.
    const template = await engine.getTemplate(templateIdentifier);

    if (!template) {
        throw new Error('Template missing after import.');
    }

    const receivingScript = getTemplateLockingScriptOrThrow(template, 'receivingLockingScript');
    const sendIntent = (receivingScript.roles?.receiver?.actions ?? []).find((intent) => intent.action === 'sendSatoshis');

    if (!sendIntent) {
        throw new Error('sendSatoshis intent not found.');
    }

    // Step 5: create the invitation. The identifier is at .invitation.invitationIdentifier, not on the top level.
    const recipientBytecode = await engine.generateLockingBytecodeFromDefaultPolicy('receive');
    const created = await engine.createInvitation({
        templateIdentifier,
        actionIdentifier: 'sendSatoshis',
        intent: sendIntent,
        variables: [
            { variableIdentifier: 'transferredSatoshis', roleIdentifier: 'sender', value: SEND_SATS },
            { variableIdentifier: 'recipientLockingscript', roleIdentifier: 'sender', value: recipientBytecode },
        ],
        inputs: [{ outpointTransactionHash: hexToBin(fundedOutput.outpointTransactionHash), outpointIndex: fundedOutput.outpointIndex }],
    });
    const { invitationIdentifier } = created.invitation;

    console.log(`Invitation created: ${invitationIdentifier}`);

    // Step 6: add the output that pays the recipient.
    await engine.appendInvitation(invitationIdentifier, {
        templateIdentifier,
        actionIdentifier: 'sendSatoshis',
        outputs: [{ outputIdentifier: 'transferSatoshisOutput' }],
    });

    // Step 7: change first, then sign.
    const leftover = await engine.calculateChange(invitationIdentifier);
    const fee = BigInt(await engine.estimateTransactionFee(invitationIdentifier));
    const change = BigInt(leftover.valueSatoshis) - fee;

    if (change >= BigInt(DUST_LIMIT_SATOSHIS) || leftover.tokens.length > 0) {
        await engine.addChangeToInvitation(invitationIdentifier);
    }

    for (const inputIndex of await engine.listOwnInputIndexes(invitationIdentifier)) {
        await engine.signInvitation(invitationIdentifier, inputIndex);
    }

    const missing = await engine.listMissingRequirements(invitationIdentifier);

    console.log(`Missing before execute: ${JSON.stringify(missing, bigintSafe)}`);

    // Step 8: execute and broadcast (chipnet only).
    const { builtTransaction, storedInvitation } = await engine.executeAction(invitationIdentifier, { broadcastTransaction: true });

    console.log(`\nBROADCAST on chipnet. Transaction hash: ${builtTransaction.transactionHash}`);
    const savedTo = join(FOLDER, `invitation-${invitationIdentifier}-executed.json`);

    writeFileSync(savedTo, serializeInvitation(storedInvitation.invitation));
    console.log(`\nSaved the executed invitation to ${savedTo}`);
    console.log('Open https://blaze.xo.cash/ and paste or upload the contents of that file.');
    console.log('\n--- executed invitation (same content, for reading) ---');
    console.log(JSON.stringify(storedInvitation.invitation, bigintSafe, 2));
} catch (error) {
    if (process.exitCode !== 2) {
        console.error(`\nFAILED: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`);
        process.exitCode = 1;
    }
} finally {
    await engine.stop().catch(() => undefined);
    process.exit(process.exitCode ?? 0);
}
