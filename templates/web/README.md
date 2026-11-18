# Template tools (dev only)

A small page for building XO invitations for the templates in this workspace, so they can be imported into an XO wallet without writing a script. It is styled like `frontend/` but is not part of the site.

Templates so far: **Drip Mine**. The others are listed as "not yet".

```bash
cd templates
npm run web          # http://127.0.0.1:5180
npm run web:build    # static build into web/dist (gitignored)
```

### Docker image

`templates/Dockerfile` builds the page and serves it with nginx (unprivileged, port 8080). The build context is `templates/`:

```bash
cd templates
docker build -t xogrid-template-tools .
docker run --rm -p 8080:8080 xogrid-template-tools    # http://localhost:8080
```

From the repo root, use `docker build -t xogrid-template-tools templates`.

- **Build context:** `templates/.dockerignore` is an allow-list that lets in only these:
  - `package.json` and `package-lock.json`
  - each system's `template.json`
  - `web/`

  So the chipnet test wallet in `templates/.xo-demo` never reaches the build.
- **Logo:** `web/src/assets/xogridlogo.png` is a copy of `frontend/src/assets/images/xogridlogo.png`, so `templates/` builds on its own. A test fails if the two differ; to update, copy the file again.
- **Page headers:** `web/nginx.conf` sends `X-Robots-Tag: noindex` and doesn't cache `index.html`. Built assets are cached for good.
- **Image:** about 75 MB.

## Drip Mine

1. Pick **chipnet** or **mainnet**. The page lists the coins at the Drip Mine address from public Electrum servers. It uses listunspent, not the address history, so the busy mainnet address is fine.
2. Click **Build** on a coin, or enter one as `txid:index` with its value.
   - A coin over 740 sats becomes a `drip`: the payout goes to the miner as the fee, and the rest goes back to the Drip Mine.
   - A coin of 740 sats or less becomes a `terminate`: it is paid out whole into a 0-sat `OP_RETURN`.
   - Unconfirmed coins can't be used, because the contract requires the coin to be at least one block old.
3. Click **Copy invitation** and import it in your XO wallet.

The invitation is complete: it holds the coin as its input, the input's unlocking bytecode (the redeem-script push), the output and the `dripCoinSatoshis` variable. Your wallet adds no coins and no signatures.

## How it works

- Everything runs in the browser. Nothing is broadcast from this page; the wallet that imports the invitation broadcasts it.
- `src/lib/invitation.ts`:
  - Each invitation gets a **fresh throwaway signing key**, which holds no funds. XO requires every commit to be signed, and this key signs them. The same pattern worked for a mainnet drip imported into an XO wallet.
  - Before it shows anything, the page checks the copy you'll get. It parses the serialized invitation back. `listInvitationValidationIssues` must find no issues. XO's merge and transaction builder must build it. The BCH 2026 VM must verify the transaction.
- `src/lib/drip-mine.ts` takes everything from the committed `drip-mine/template.json`: the template identifier, the redeem script, and the payout constants.
- XO's engine is used unchanged. Its state package statically imports Node-only modules (`fs`, `path`, `better-sqlite3`, `indexeddbshim`) for a wallet database this page never opens, so `vite.config.ts` swaps them for the small stand-ins in `stubs/`.
- Clipboard: if the browser refuses the async Clipboard API, Copy falls back to a hidden textarea.

## Verified

- `test/drip-invitation.test.ts` (part of `npm test`) builds drip and terminate invitations for both networks. It checks:
  - XO validation and the VM
  - the payout formula
  - the outputs
  - that the copied JSON parses back
  - that each invitation gets a fresh signer
- On 2026-11-18, the page built a chipnet drip invitation for coin `41cab9a2…b27e:0`. XO in Node rebuilt the identical transaction from the copied JSON, and chipnet accepted it: `d9b06e354ff095326c75d1d58447591e062efeba0ebc2d419a9abecb5ddaf39c`.
- Mainnet: the page lists coins and builds `xpub`-signed invitations; nothing was broadcast.

## Adding a template

Add `src/lib/<system>.ts`, which builds the commits with `startInvitation` and checks them with `finishInvitation`. Then add a panel in `src/components/` and mark the template ready in `App.tsx`.
