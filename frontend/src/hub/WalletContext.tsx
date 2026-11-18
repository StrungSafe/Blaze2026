import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { hexToBin } from "@bitauth/libauth";

import { addressFor, walletLockingBytecode, type Network } from "../voucher/core";
import { publicKeyHex, startWalletSession, type WalletSession } from "./wallet";

// One wallet connection for the whole site. The navbar, the connect modal, the Admin sign-in, the review form and the
// Demo all read it from here, so a person connects once and every page sees the same wallet.
//
// The connection lives in memory only: a page reload (or closing the tab) ends it, because the wallet relay session is
// not stored anywhere. Nothing here holds keys; the wallet signs on its own device.

export interface WalletContextValue {
  /** The live WizardConnect session, or null when nothing is connected or pending. */
  session: WalletSession | null;
  /** Wallet name once the wallet is ready, otherwise an empty string. */
  walletName: string;
  /** True only when a wallet has announced it is ready. */
  connected: boolean;
  /** The wallet's first receive address on the current network, or "" until the wallet has shared its key. */
  address: string;
  /** Which network the address is shown for. The Demo keeps this in step with its network switch. */
  network: Network;
  setNetwork: (network: Network) => void;
  /** Last relay status text, for display while connecting. */
  status: string;
  modalOpen: boolean;
  openModal: () => void;
  closeModal: () => void;
  /** Starts a fresh WizardConnect session, replacing any pending or live one. Returns it so the caller can show the QR. */
  start: () => WalletSession;
  /** Ends the session (pending or connected). */
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

/** "bchtest:qp9c…tw6y": the prefix, the first four and the last four characters. Short strings are returned as they are. */
export function shortenAddress(address: string): string {
  const separator = address.indexOf(":");
  const prefix = separator >= 0 ? address.slice(0, separator + 1) : "";
  const body = separator >= 0 ? address.slice(separator + 1) : address;

  return body.length > 12 ? `${prefix}${body.slice(0, 4)}…${body.slice(-4)}` : address;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<WalletSession | null>(null);
  const [walletName, setWalletName] = useState("");
  const [status, setStatus] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [publicKey, setPublicKey] = useState("");
  const [network, setNetwork] = useState<Network>("chipnet");

  const sessionRef = useRef<WalletSession | null>(null);
  const connectedRef = useRef(false);

  const teardown = useCallback(() => {
    sessionRef.current?.cleanup();
    sessionRef.current = null;
    connectedRef.current = false;
    setSession(null);
    setWalletName("");
    setPublicKey("");
    setStatus("");
  }, []);

  const start = useCallback((): WalletSession => {
    sessionRef.current?.cleanup();
    connectedRef.current = false;
    setWalletName("");
    setPublicKey("");
    setStatus("");

    let created: WalletSession | undefined;
    // Ignore late events from a session that has since been replaced or ended.
    const isCurrent = () => created === undefined || sessionRef.current === created;

    created = startWalletSession(
      (text) => {
        if (isCurrent()) setStatus(text);
      },
      (name) => {
        if (!isCurrent()) return;
        connectedRef.current = true;
        setWalletName(name);
      },
      () => {
        if (!isCurrent()) return;
        connectedRef.current = false;
        setWalletName("");
        setPublicKey("");
        setStatus("Wallet disconnected.");
      },
    );

    sessionRef.current = created;
    setSession(created);

    return created;
  }, []);

  const openModal = useCallback(() => setModalOpen(true), []);

  // Closing the modal keeps a connected wallet, but drops a connection attempt nobody finished.
  const closeModal = useCallback(() => {
    setModalOpen(false);

    if (!connectedRef.current) {
      teardown();
    }
  }, [teardown]);

  useEffect(() => () => sessionRef.current?.cleanup(), []);

  // Wallets announce "ready" slightly before their keys arrive. Wait for the first receive key, which is the address
  // the navbar shows. If it never arrives the navbar keeps showing the wallet's name instead.
  useEffect(() => {
    if (!walletName || !session) return;

    let current = true;

    publicKeyHex(session)
      .then((key) => {
        if (current) setPublicKey(key);
      })
      .catch(() => undefined);

    return () => {
      current = false;
    };
  }, [walletName, session]);

  const address = useMemo(() => {
    if (!publicKey) return "";

    try {
      return addressFor(walletLockingBytecode(hexToBin(publicKey)), network);
    } catch {
      return "";
    }
  }, [publicKey, network]);

  const value = useMemo<WalletContextValue>(
    () => ({
      session,
      walletName,
      connected: walletName !== "",
      address,
      network,
      setNetwork,
      status,
      modalOpen,
      openModal,
      closeModal,
      start,
      disconnect: teardown,
    }),
    [session, walletName, address, network, status, modalOpen, openModal, closeModal, start, teardown],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const value = useContext(WalletContext);

  if (!value) {
    throw new Error("useWallet must be used inside <WalletProvider>.");
  }

  return value;
}
