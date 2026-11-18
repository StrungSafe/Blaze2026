# Template tools (dev only)

A small page for building XO invitations for the templates in this workspace, so they can be imported into an XO wallet without writing a script. It is styled like `frontend/` but is not part of the site.

Templates so far: **Drip Mine** and **Token Burner**; pick one in the sidebar or with the URL hash (`#drip-mine`, `#token-burner`). The others are listed as "not yet".

```bash
cd templates
npm run web          # http://127.0.0.1:5180
npm run web:build    # static build into web/dist (gitignored)
```

### Vercel (static, no container)

Set the Vercel project's **Root Directory** to `templates`. [`templates/vercel.json`](../vercel.json) sets the rest:
- **Install:** `npm ci --ignore-scripts`. The workspace's XO engine packages pull in native SQLite modules (`sqlite3`, and an old `better-sqlite3` through `websql-configurable`). Vercel's npm runs their install scripts, which fail to compile on current Node. The page never loads them; its browser build replaces them with stand-ins.
- **Build:** `npm run web:build`.
- **Output:** `web/dist`.
- **Headers:** `noindex`, and long caching for the built assets.

The same install and build were checked on Node 26.13.1 with npm 11.20, the versions Vercel used.

### Docker image

`templates/Dockerfile` builds the page and serves it with nginx (unprivileged, port 8080). The build context is `templates/`:

```bash
cd templates
docker build -t xogrid-template-tools .
docker run --rm -p 8080:8080 xogrid-template-tools    # http://localhost:8080
```

From the repo root, use `docker build -t xogrid-template-tools templates`.

- **Build context:** `templates/.dockerignore` keeps out the chipnet test wallet (`.xo-demo`, mnemonic, keys, `.sqlite` files), `.env` files, `node_modules` and `dist`.
  - It is a deny-list on purpose. Vercel builds with buildah, which doesn't look inside folders an allow-list's `*` excluded, so the systems' `template.json` files went missing.
  - The Dockerfile uses fully qualified image names (`docker.io/...`), which buildah needs without a prompt.
  - Both Docker and buildah build it.
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

## Token Burner (`#token-burner`)

1. Pick **chipnet** or **mainnet**. The page lists the coins at the shared TokenBurner address, with their tokens: fungible amount, NFT capability and commitment, and category.
2. Tick the coins to burn. **Select all** sweeps the whole address. Unconfirmed coins are fine, because the contract has no age check.
3. Optionally type a farewell message, then click **Burn N coins**.
4. Click **Copy invitation** and import it in your XO wallet.

The invitation is the template's `burn` action, and it holds everything the burn needs:
- every selected coin as a `burnerInput`, each with its value and tokens
- each input's unlocking bytecode (the redeem-script push)
- the `burnMessage` variable
- the single `farewellOutput`: a 0-sat, token-free `OP_RETURN <message>`

The burn destroys every token on the selected coins, including coins other people sent there; anyone can burn anything sent to this address. All the coins' satoshis become the fee.

Deposits aren't built here. They spend the wallet's own coins, so the XO wallet makes them itself from the template's `depositFungibleTokens`, `depositNonfungibleToken` and `depositSatoshis` actions.

**Message limit: 219 bytes, not 220.** The template says "up to 220 bytes", but Libauth's standardness check counts the `OP_RETURN` script's length byte toward the 223-byte data-carrier limit. So a 220-byte message measures 224 and fails the VM check this page runs. The template is unchanged, because editing its description would change its identifier.

## How it works

- Everything runs in the browser. Nothing is broadcast from this page; the wallet that imports the invitation broadcasts it.
- `src/lib/invitation.ts`:
  - Each invitation gets a **fresh throwaway signing key**, which holds no funds. XO requires every commit to be signed, and this key signs them. The same pattern worked for a mainnet drip imported into an XO wallet.
  - Before it shows anything, the page checks the copy you'll get. It parses the serialized invitation back. `listInvitationValidationIssues` must find no issues. XO's merge and transaction builder must build it. The BCH 2026 VM must verify the transaction.
- `src/lib/drip-mine.ts` takes everything from the committed `drip-mine/template.json`: the template identifier, the redeem script, and the payout constants. `src/lib/token-burner.ts` does the same with `token-burner/template.json`.
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
- `test/token-burn-invitation.test.ts` burns, in one invitation on both networks, a fungible-token coin, an NFT coin and a plain BCH coin. It checks:
  - XO validation and the VM, with the tokens on the spent coins
  - exactly one token-free 0-sat `OP_RETURN` output
  - the fee and token totals
  - the message limit
  - that the copied JSON carries every input's tokens and unlocking bytecode
- On 2026-11-18, the page built a chipnet burn of both coins then at the burner (4,812 and 2,000 sats, BCH only). XO in Node rebuilt the identical transaction from the copied JSON, and chipnet accepted it: `dfa10d4f704104cd58fea0c87fe7ca55a6700e75d6f0b521d8ab09c6a0b1a4fa`.
- A chipnet burn with tokens on-chain is still to do. The test wallet's spendable BCH is too low to deposit test tokens first; the token inputs are covered by the tests above.

## Adding a template

Add `src/lib/<system>.ts`, which builds the commits with `startInvitation` and checks them with `finishInvitation`. Then add a panel in `src/components/`, which can reuse `common.tsx` (network toggle, address, coin loading) and `InvitationResult`, and give the template a `panel` in `App.tsx`.
