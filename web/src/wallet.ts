import { binToHex } from '@bitauth/libauth';
import { initiateDappRelay } from '@wizardconnect/core';
import { DappConnectionManager } from '@wizardconnect/dapp';
import { buildWalletSignRequest } from '../../server/src/auth/challenge-transaction';

export interface WalletSession {
    manager: DappConnectionManager;
    cleanup: () => void;
    uri: string;
    qrUri: string;
}

/** Starts a WizardConnect session. onStatus receives relay status text; onReady fires once the wallet has shared its keys. */
export function startWalletSession(onStatus: (text: string) => void, onReady: (walletName: string) => void): WalletSession {
    const manager = new DappConnectionManager('XOGrid', undefined, { session: false });
    const relay = initiateDappRelay((payload) => {
        manager.updateConnection(payload.client, payload.status);
        onStatus(payload.status.status);
    });

    manager.attachRelay(relay);
    manager.on('walletready', () => onReady(manager.walletName ?? 'wallet'));

    return { manager, cleanup: relay.cleanup, uri: relay.uri, qrUri: relay.qrUri };
}

/** Asks the wallet to sign the login challenge (never broadcast) and returns the signed transaction hex. */
export async function signLoginChallenge(session: WalletSession, nonce: string): Promise<string> {
    const publicKey = session.manager.getPubkey(0, 0n);

    if (!publicKey) {
        throw new Error('The wallet did not share a receive key.');
    }

    const request = buildWalletSignRequest(nonce, publicKey);
    const response = await session.manager.signTransaction({ transaction: request as never, inputPaths: [[0, 'receive', 0]] });

    if (response.error) {
        throw new Error(`Wallet refused: ${response.error}`);
    }

    void binToHex;

    return response.signedTransaction;
}
