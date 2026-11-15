import { binToHex } from '@bitauth/libauth';
import { ElectrumClient } from '@electrum-cash/network';
import { initiateDappRelay } from '@wizardconnect/core';
import { DappConnectionManager } from '@wizardconnect/dapp';
import QRCode from 'qrcode';
import { FEE_SATOSHIS, MINIMUM_COIN_SATOSHIS, addressFor, buildSignRequest, electrumScriptHash, lockingBytecodeFor, verifySignedSpend, type Coin } from './spend-core.js';

const HOSTS = ['bch.imaginary.cash', 'electrum.imaginary.cash', 'cashnode.bch.ninja', 'fulcrum.greyh.at'];
const SCAN_PER_PATH = 20;
const PATHS: { childIndex: number; name: string }[] = [
    { childIndex: 0, name: 'receive' },
    { childIndex: 1, name: 'change' },
];

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const logEl = el<HTMLPreElement>('log');
const lines: string[] = [];

function log(line: string, cls?: 'ok' | 'bad'): void {
    lines.push(line);
    logEl.textContent = lines.join('\n');
    logEl.className = cls ?? '';
}

const manager = new DappConnectionManager('XOGrid mainnet probe', undefined, { session: false });
let relay: ReturnType<typeof initiateDappRelay> | undefined;
let client: ElectrumClient<never> | undefined;
let coins: Coin[] = [];
let scanning = false;
let chosen: Coin | undefined;
let signedHex: string | undefined;
let signedId: string | undefined;

async function electrum(): Promise<ElectrumClient<never>> {
    if (client) {
        return client;
    }

    for (const host of HOSTS) {
        try {
            const candidate = new ElectrumClient<never>('XOGrid probe', '1.4.1', host, { port: 50004, encrypted: true, timeoutInMilliSeconds: 10000 } as never);

            await candidate.connect();
            client = candidate;
            log(`Connected to mainnet Electrum server ${host}`);

            return candidate;
        } catch (error) {
            log(`Server ${host} unavailable: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    throw new Error('No mainnet Electrum server reachable from this browser.');
}

async function request(method: string, ...parameters: (string | number | boolean | object | null)[]): Promise<unknown> {
    const result = await (await electrum()).request(method, ...parameters);

    if (result instanceof Error) {
        throw result;
    }

    return result;
}

async function listPlainCoins(scriptHash: string): Promise<{ tx_hash: string; tx_pos: number; value: number; token_data?: unknown }[]> {
    let response: unknown;

    try {
        response = await request('blockchain.scripthash.listunspent', scriptHash, 'exclude_tokens');
    } catch {
        response = await request('blockchain.scripthash.listunspent', scriptHash);
    }

    // Never touch a coin that carries CashTokens: a plain spend would burn them.
    return (response as { tx_hash: string; tx_pos: number; value: number; token_data?: unknown }[]).filter((coin) => coin.token_data === undefined);
}

async function findCoins(): Promise<void> {
    if (scanning) {
        log('A scan is already running; wait for it to finish.');

        return;
    }

    scanning = true;
    el<HTMLButtonElement>('find').disabled = true;
    coins = [];
    el('coins').innerHTML = '';
    log('Scanning the first ' + SCAN_PER_PATH + ' receive and change addresses for plain coins...');

    for (const path of PATHS) {
        if (!manager.hasPath(path.childIndex)) {
            log(`Wallet did not share the ${path.name} path.`);
            continue;
        }

        for (let index = 0; index < SCAN_PER_PATH; index += 1) {
            const publicKey = manager.getPubkey(path.childIndex, BigInt(index));

            if (!publicKey) {
                continue;
            }

            for (const found of await listPlainCoins(electrumScriptHash(lockingBytecodeFor(publicKey)))) {
                if (coins.some((known) => known.transactionHash === found.tx_hash && known.outputIndex === found.tx_pos)) {
                    continue;
                }

                coins.push({ transactionHash: found.tx_hash, outputIndex: found.tx_pos, valueSatoshis: BigInt(found.value), pathName: path.name, childIndex: path.childIndex, addressIndex: index, publicKey });
            }
        }
    }

    coins.sort((a, b) => Number(b.valueSatoshis - a.valueSatoshis));
    scanning = false;
    el<HTMLButtonElement>('find').disabled = false;

    if (coins.length === 0) {
        log('No plain coins found. Send about 3,000 sats of mainnet BCH to your Selene receive address and press Find coins again.', 'bad');

        return;
    }

    log(`Found ${coins.length} plain coin(s).`, 'ok');

    for (const coin of coins) {
        const usable = coin.valueSatoshis >= MINIMUM_COIN_SATOSHIS;
        const button = document.createElement('button');

        button.textContent = `${coin.valueSatoshis} sats  (${coin.pathName}/${coin.addressIndex}, ${coin.transactionHash.slice(0, 8)}...:${coin.outputIndex})${usable ? '' : '  - too small (needs ' + MINIMUM_COIN_SATOSHIS + ')'}`;
        button.disabled = !usable;
        button.addEventListener('click', () => choose(coin));
        el('coins').appendChild(button);
    }
}

function choose(coin: Coin): void {
    chosen = coin;
    signedHex = undefined;
    el<HTMLButtonElement>('broadcast').disabled = true;
    el('plan').textContent = [
        `Coin:    ${coin.valueSatoshis} sats  ${coin.transactionHash}:${coin.outputIndex}`,
        `Address: ${addressFor(coin.publicKey)}  (${coin.pathName}/${coin.addressIndex})`,
        `Sends:   ${coin.valueSatoshis - FEE_SATOSHIS} sats back to the SAME address`,
        `Fee:     ${FEE_SATOSHIS} sats  (the only money that leaves your wallet)`,
    ].join('\n');
    el<HTMLButtonElement>('sign').disabled = false;
}

manager.on('walletready', () => {
    log(`Wallet ready: ${manager.walletName ?? '(unnamed)'}, protocol ${manager.protocol}`, 'ok');
    el<HTMLButtonElement>('find').disabled = false;
});
manager.on('disconnect', (reason, message) => log(`Disconnected: ${reason} ${message ?? ''}`, 'bad'));

el('connect').addEventListener('click', () => {
    relay?.cleanup();
    log('Creating WizardConnect session...');
    relay = initiateDappRelay((payload) => {
        manager.updateConnection(payload.client, payload.status);
        log(`Relay: ${payload.status.status}${payload.status.error ? ' ' + payload.status.error : ''}`);
    });
    manager.attachRelay(relay);
    el('uri').textContent = relay.uri;
    void QRCode.toCanvas(el<HTMLCanvasElement>('qr'), relay.qrUri, { width: 280 });
});

el('find').addEventListener('click', () => {
    findCoins().catch((error) => {
        scanning = false;
        el<HTMLButtonElement>('find').disabled = false;
        log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'bad');
    });
});

el('sign').addEventListener('click', async () => {
    if (!chosen) {
        return;
    }

    try {
        log('Asking Selene to sign (approve it on your phone)...');

        const response = await manager.signTransaction({
            transaction: buildSignRequest(chosen) as never,
            inputPaths: [[0, chosen.pathName, chosen.addressIndex]],
        });

        if (response.error) {
            log(`Wallet returned an error: ${response.error}`, 'bad');

            return;
        }

        const verdict = verifySignedSpend(chosen, response.signedTransaction);

        if (!verdict.valid) {
            log(`NOT SAFE TO BROADCAST. ${verdict.reason}`, 'bad');
            log(`signedTransaction was: ${response.signedTransaction}`);

            return;
        }

        signedHex = verdict.transactionHex;
        signedId = verdict.transactionId;
        log(`Signature verified locally. Same input, one output to the same address, fee ${FEE_SATOSHIS} sats.`, 'ok');
        log(`Transaction id: ${signedId}`);
        log('Press Broadcast to send it to the network.');
        el<HTMLButtonElement>('broadcast').disabled = false;
    } catch (error) {
        log(`Error: ${error instanceof Error ? error.message : String(error)}`, 'bad');
    }
});

el('broadcast').addEventListener('click', async () => {
    if (!signedHex || !signedId) {
        return;
    }

    el<HTMLButtonElement>('broadcast').disabled = true;

    try {
        const returned = await request('blockchain.transaction.broadcast', signedHex);

        log(`BROADCAST OK. Server returned: ${String(returned)}`, returned === signedId ? 'ok' : 'bad');
        log(`View: https://blockchair.com/bitcoin-cash/transaction/${signedId}`);
        log('Selene signing + broadcasting a real mainnet spend works. Copy this whole log back to Nathaniel.');
    } catch (error) {
        log(`Broadcast failed: ${error instanceof Error ? error.message : String(error)}`, 'bad');
    }
});

void binToHex;
