import { binToHex, secp256k1 } from '@bitauth/libauth';
import { initiateDappRelay } from '@wizardconnect/core';
import { DappConnectionManager } from '@wizardconnect/dapp';
import QRCode from 'qrcode';
import {
    buildWalletSignRequest,
    publicKeyMatchesIdentity,
    verifyChallengeTransaction,
} from '../../server/src/auth/challenge-transaction.js';

const el = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const logEl = el<HTMLPreElement>('log');
const lines: string[] = [];

function log(line: string, cls?: 'ok' | 'bad'): void {
    if (lines[lines.length - 1] === line) {
        return;
    }

    lines.push(line);
    logEl.textContent = lines.join('\n');
    logEl.className = cls ?? '';
}

// Serialises bigint and bytes so errors and responses can be shown as text.
const show = (value: unknown): string =>
    JSON.stringify(value, (_k, v) => (typeof v === 'bigint' ? `${v}n` : v instanceof Uint8Array ? binToHex(v) : v), 2);

const manager = new DappConnectionManager('XOGrid probe', undefined, { session: false });
let relay: ReturnType<typeof initiateDappRelay> | undefined;

manager.on('walletready', () => {
    log(`Wallet ready: ${manager.walletName ?? '(unnamed)'}, protocol ${manager.protocol}`);
    log(`Shared paths: ${manager.getSessionPaths().map((p) => p.name).join(', ')}`);
    el<HTMLButtonElement>('sign').disabled = false;
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

el('sign').addEventListener('click', async () => {
    try {
        const nonce = binToHex(crypto.getRandomValues(new Uint8Array(16)));
        const publicKey = manager.getPubkey(0, 0n);

        if (!publicKey) {
            log('No receive/0 public key from the wallet.', 'bad');

            return;
        }

        log(`Challenge nonce ${nonce}`);
        log(`Signing with receive/0 key ${binToHex(publicKey)}`);

        const request = buildWalletSignRequest(nonce, publicKey);
        const started = Date.now();
        const response = await manager.signTransaction({
            // Already in the relay's JSON form (hex strings, "<bigint: Xn>"), so nothing here needs BigInt handling.
            transaction: request as never,
            inputPaths: [[0, 'receive', 0]],
        });

        log(`Wallet answered in ${Date.now() - started} ms`);

        if (response.error) {
            log(`Wallet returned an error: ${response.error}`, 'bad');
            log('WHAT THIS MEANS: the wallet refused or could not sign this challenge. Report the exact text above.');

            return;
        }

        log(`signedTransaction: ${response.signedTransaction}`);

        const verdict = verifyChallengeTransaction(nonce, response.signedTransaction);

        if (!verdict.valid) {
            log(`Hub verifier REJECTED the signature: ${verdict.reason}`, 'bad');

            return;
        }

        const matches = publicKeyMatchesIdentity(verdict.publicKey!, binToHex(publicKey));

        log(`Hub verifier ACCEPTED. Signer key: ${verdict.publicKey}`, matches ? 'ok' : 'bad');
        log(matches ? 'Signer key equals the receive/0 key. Login by wallet works.' : 'Signer key differs from receive/0 key.');
        log(`Wallet shared xpub paths: ${show(manager.getSessionPaths())}`);
        void secp256k1;
    } catch (error) {
        log(`Error: ${error instanceof Error ? error.message : show(error)}`, 'bad');
    }
});
