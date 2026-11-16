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

const hex = (key: Uint8Array): string => Array.from(key, (byte) => byte.toString(16).padStart(2, "0")).join("");

/**
 * The wallet's first receive key as compressed-public-key hex. Wallets announce "ready" slightly before their keys
 * arrive, so this waits for the key instead of failing on the first look.
 */
export async function publicKeyHex(
  session: Pick<WalletSession, "manager">,
  timeoutMs = 10_000,
  intervalMs = 250,
): Promise<string> {
  const deadline = Date.now() + timeoutMs;

  for (;;) {
    const key = session.manager.getPubkey(0, 0n);

    if (key) {
      return hex(key);
    }

    if (Date.now() >= deadline) {
      throw new Error("The wallet did not share a receive key. Keep the wallet open on its home screen and try again.");
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
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
