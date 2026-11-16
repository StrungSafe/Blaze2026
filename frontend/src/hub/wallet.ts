import { initiateDappRelay } from "@wizardconnect/core";
import { DappConnectionManager } from "@wizardconnect/dapp";

export interface WalletSession {
  manager: DappConnectionManager;
  cleanup: () => void;
  uri: string;
  qrUri: string;
}

/** Starts a WizardConnect session (Selene, Paytaca and other WizardConnect wallets). */
export function startWalletSession(
  onStatus: (text: string) => void,
  onReady: (walletName: string) => void,
): WalletSession {
  const manager = new DappConnectionManager("XOGrid", undefined, { session: false });
  const relay = initiateDappRelay((payload) => {
    manager.updateConnection(payload.client, payload.status);
    onStatus(payload.status.status);
  });
  let announced = false;

  manager.attachRelay(relay);
  // Some wallets report "wallet ready" more than once; announce it once.
  manager.on("walletready", () => {
    if (!announced) {
      announced = true;
      onReady(manager.walletName ?? "wallet");
    }
  });

  return { manager, cleanup: relay.cleanup, uri: relay.uri, qrUri: relay.qrUri };
}

/** The wallet's first receive key as compressed-public-key hex. */
export function publicKeyHex(session: WalletSession): string {
  const key = session.manager.getPubkey(0, 0n);

  if (!key) {
    throw new Error("The wallet did not share a receive key.");
  }

  return Array.from(key, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Asks the wallet to sign a request from the server. Nothing is broadcast and no funds move. */
export async function signWithWallet(session: WalletSession, request: object): Promise<string> {
  const response = await session.manager.signTransaction({
    transaction: request as never,
    inputPaths: [[0, "receive", 0]],
  });

  if (response.error) {
    throw new Error(`Wallet refused: ${response.error}`);
  }

  return response.signedTransaction;
}
