# Selene login probe

Tests the one thing that cannot be checked without a real wallet: will Selene sign the hub's moderator-login
challenge (a transaction that spends a made-up output, with `broadcast: false`)?

    cd probe
    npm install --legacy-peer-deps
    npm run serve        # builds, then serves http://localhost:8080

Open the page on your computer, press Connect, scan the QR with Selene, press "Sign login challenge", approve.
Copy the whole Result box back. Nothing is broadcast and no funds move.

Possible outcomes:
- "Hub verifier ACCEPTED ... Login by wallet works." The challenge-transaction login is proven with Selene.
- "Wallet returned an error": Selene refuses a non-existent input. Send the exact text; the fallback is a
  login that signs a real, tiny, never-broadcast spend, or a CLI signer for moderators.
- Nothing happens after scanning: report the Relay lines in the box.


## Mainnet spend probe (spend.html)

Proves that Selene can sign and broadcast a real mainnet spend before the XOGrid Demo page depends on it.
It moves one plain coin back to the same address; only a fixed 250 sat fee leaves the wallet. CashToken coins are skipped.

    cd probe && npm install && npm run build && python3 -m http.server 8090 -d dist
    open http://localhost:8090/spend.html

Steps on the page: Connect (scan the QR in Selene), Find coins, click a coin (at least 796 sats), Sign (approve in Selene),
then Broadcast. The page verifies the signed transaction itself (same input, one output to the same address, valid signature)
and refuses to offer Broadcast otherwise. Logic lives in `src/spend-core.ts`, tested in `server/test/spend-probe.test.ts`.
