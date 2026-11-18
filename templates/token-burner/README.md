# Token Burner

Provably burn CashTokens. Anyone can send tokens to the shared TokenBurner address. Anyone can then destroy them in a transaction whose only output is an `OP_RETURN` farewell message. Burns are final, and the satoshis sent with the tokens go to miners.

This template wraps the **live TokenBurner contract unchanged**, so XO wallets burn into the same address that [tokenburner.cash](https://www.tokenburner.cash/) shows, and their burns appear in its feed.

| | |
| --- | --- |
| Status | Chipnet verified (mint, deposit, burn, a 9-coin burn of other people’s deposits, and a BCH deposit swept through the `burn` start action, all on 2026-11-16). 21 offline tests. Blaze Tool check pending. |
| Contract | [`burner.cash`](burner.cash), verbatim from upstream, rebuilt with cashc 0.9.3 (the upstream compiler). 13 opcodes, 15 bytes. |
| Redeem script | `c4519d00d10088016a00cd517f7587` |
| Address (mainnet) | `bitcoincash:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlc2s5qtune` |
| Address (chipnet) | `bchtest:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlcfh97n0xt` |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `1ef44c322bbcd2db0f376b9359a1255a6560e0365a21d8811c4d85b3b57247e0` (the runs below used `2fb462ac…`, which lacked the BCH deposit and the `burn` start entry, and `9ab922f2…`, from before the folder was renamed; the burner script is the same) |

## Credits

- **Contract and original app:** [TokenBurner](https://www.tokenburner.cash/) by **Dagur Valberg Johannsson** ([@dagur](https://x.com/dagur), GitLab [dagurval](https://gitlab.com/dagurval)).
- **Source:** [`burner.cash`](https://gitlab.com/dagurval/contract-burner/-/blob/f20240756800e07c091f35e0227967e7db8727d3/burner.cash) in [dagurval/contract-burner](https://gitlab.com/dagurval/contract-burner), commit `f2024075` (2026-05-07). The compiled artifact we compare against is upstream `js/burner.json` at the same commit.
- **Licence:** the upstream README says the contract is MIT-licensed. The repository has no LICENSE file, so there is no copyright line to reproduce. If one is added upstream, copy it here.
- **Adapted by:** XOGrid, in this folder. Only the XO template is new. The contract is unchanged.

## Design

One contract, one function (`burn()`), and no constructor parameters, so every deposit shares one well-known address.

Transaction layouts:

| Transaction | Inputs | Outputs |
| --- | --- | --- |
| Deposit (XO `depositFungibleTokens` / `depositNonfungibleToken`) | the depositor's coins | `burnerFungibleOutput` or `burnerNonfungibleOutput` at the burner address, plus the depositor's change (including leftover tokens) |
| Burn (XO `burn`) | one or more burner coins | **exactly one output, at index 0:** `OP_RETURN <message>`, value 0, no token |

### Why the contract is used unchanged

Changing even one byte would change the address, which would split XO burns away from tokenburner.cash and its burn feed. Two choices that our house rules would usually flag are deliberate:

- **Fixed output 0 and `tx.outputs.length == 1`.** This is the security property. With a single output that must be a token-free `OP_RETURN`, nobody can redirect a deposit's satoshis or tokens anywhere.
- **One shared address.** Burns compete for the same coins, but that's harmless: whoever burns first wins, and the tokens are destroyed either way.

### Mapping into the template

| Contract | Template |
| --- | --- |
| Compiled bytecode (no constructor parameters) | `scripts.burnerBytecode`, read from `artifact/Burner.json` |
| Contract address | `lockingScripts.burnerLockingScript`, `lockingType: "p2sh"` (P2SH32) |
| `burn()` | action `burn` → `burnTransaction` → input `burnerInput` with an empty unlocking script (only one function, so no selector) |
| The single `OP_RETURN` output | `farewellOutput` → `farewellLockingScript` (`OP_RETURN <burnMessage>`), value 0, `token: null` |
| Sending tokens or BCH to the burner | `start` actions `depositFungibleTokens`, `depositNonfungibleToken` and `depositSatoshis` |
| Starting a burn | `start` action `burn` (also offered on burner coins the wallet tracks) |

Roles: `depositor` sends tokens, and `burner` (anyone) destroys them. A depositor who tracks the burner output for the `burner` role can burn it themselves. Burner coins have zero balance and `selectable: false`, so a wallet never counts them as its own funds or spends them for anything else.

## BCH: a gift to miners, not a burn

`depositSatoshis` sends plain BCH to the burner address, but **that BCH is not destroyed**. Every burn, whether from XO’s `burn` action or from tokenburner.cash, spends burner coins into one `OP_RETURN` output carrying 0 satoshis. Whatever the coins held becomes the transaction fee and goes to the miner who mines the burn. The action, its output and its variable all say so.

The contract would allow a real BCH burn, because it only checks that the single output starts with `OP_RETURN` and carries no token, not its value. An `OP_RETURN` output with value is unspendable, so those satoshis would be destroyed. The catch is that BCH sent to the shared burner address can be swept by anyone, and the sweeper decides between burning and fee. So a guaranteed BCH burn has to happen in one step from the owner’s own coins, without the contract. We chose not to add that here.

## Safety notes

- **Burns are irreversible**, and anyone can burn anything sent to the address, including someone else's deposit. The descriptions say so.
- **The satoshis in a burner coin go to miners.** A token output needs some (about 1000 sats). Send more only if you mean to give it to a miner.
- **Only one output.** A burn can't take change, and the engine must not add any. The template marks `burnTransaction` as `composable: false` and sets `omitChangeAmounts` on `burnerInput`. Engine 0.1.1-next reads neither field (see below), so a client must not add change itself, as `scripts/chipnet.ts` shows.
- **Farewell messages** are limited to 220 bytes by `OP_RETURN` standardness rules, the same limit tokenburner.cash uses. An empty message still produces `OP_RETURN OP_0`, which the contract accepts.

## Finding to share upstream

When no farewell message is entered, the tokenburner.cash frontend (`js/mint.ts` at `f2024075`) builds a burn with **zero outputs**. Consensus rejects that ("transactions must have at least one output"), and the contract would reject it anyway, because it requires `tx.outputs.length == 1`. A bare `OP_RETURN` (`6a`) output fixes it. `test/contract.test.ts` shows both cases. This doesn't affect the template, which always adds the `OP_RETURN` output.

## Burning other people’s deposits

The `burn` action accepts any coin at the burner address, not just your own. Every deposit shares one locking script, because the contract has no parameters. So once a wallet watches the burner script, the engine tracks everyone’s deposits there, and `burn` can spend them. `scripts/chipnet.ts burn-all` does this: it lists every coin the wallet sees at the burner address and passes them all as `burnerInput` in one invitation. The engine accepts several inputs for the same template input, which the chipnet run below confirms with 9 at once. If a batch is refused, the script falls back to one burn per coin.

**Limitation:** a wallet only watches the burner address after it has used the burner, for example by depositing once. A fresh wallet can’t see, and so can’t burn, deposits it didn’t make. The template has no way to start watching an address without a deposit. `burn` is also a `start` action, so any wallet can begin a burn without holding an invitation. It still only finds the coins that wallet tracks. `burn-all` uses this start entry.

## XO engine notes (engine 0.1.1-next.18029697917)

- `omitChangeAmounts` on inputs and `composable` on transactions are in the schema, but the engine doesn't read them. The client decides whether to add change.
- The engine builds and broadcasts a transaction that destroys tokens and pays the whole coin as fee, with no extra guard. The chipnet burn below confirms this.

## Tests

```bash
cd templates && npm test
```

- `test/contract.test.ts` (10 tests, Libauth VM with real token data).
  - Accepts burning fungible tokens with a message, a bare `OP_RETURN`, an NFT, a BCH-only coin (all of it to the miner) and several burner coins at once.
  - Rejects an extra change output, a P2PKH output that takes the satoshis, an `OP_RETURN` that keeps the tokens, and an output that doesn't start with `OP_RETURN`. Each rejection is asserted to come from the contract itself.
  - Shows that consensus rejects a zero-output burn.
- `test/template.test.ts` (11 tests).
  - Rebuilding with cashc 0.9.3 reproduces the artifact, and the template's redeem script and address match the published ones.
  - Fungible, NFT and BCH-only deposits resolve through the engine's own `completeMergedOutput`, and the start actions are exactly the three deposits plus `burn`.
  - The farewell output matches tokenburner.cash's format, and a burn built from template pieces passes the VM.
  - `template.json` is current, the identifier is stable, and the registry audit reports no failures.

## Chipnet

```bash
cd templates
npx tsx token-burner/scripts/chipnet.ts mint      # creates a test token in the XO test wallet
npx tsx token-burner/scripts/chipnet.ts deposit   # XO action depositFungibleTokens
npx tsx token-burner/scripts/chipnet.ts burn      # XO action burn
npx tsx token-burner/scripts/chipnet.ts deposit-bch  # XO action depositSatoshis: 1000 sats to the burner (a gift to miners)
npx tsx token-burner/scripts/chipnet.ts burn-all  # XO action burn on every coin at the burner address, anyone's
```

Runs on 2026-11-16. The first five rows used template `2fb462ac…cb1d`, the last two `9ab922f2…2d5d`:

| Step | Transaction | What happened |
| --- | --- | --- |
| Minter funding | `0b7ed51a5de73071512ea4f17eeeb1f8a3d6796de3f5ce322e6da750820fe4b4` | XO wallet paid 3000 sats to the minter key (p2pkh template) |
| Token genesis | `7422e54bf6122972a296114d9deee6866c8768e0d51e1acbd3f3b639027932c6` | 1,000,000 units of category `0b7ed51a…e4b4` to the XO wallet |
| Deposit | `fcd0b5fc8435f068ec0a68fd7d5dc2ae1eff8ae1d77e702708cd119d4f880da9` | 250,000 tokens with 1000 sats to the burner; 750,000 tokens back as token change |
| Burn | `3ee700053e66a324a91415e9d80242a7c701ef0f4598769d134378322f721065` | One input, one output: `OP_RETURN "XOGrid test burn via the Token Burner XO template"`, no token. 250,000 tokens destroyed |
| Burn all | `af2f266a003214369ea33141d72b6095bb3093ae6f3c70be64722a09359c9c71` | Nine deposits by other people (five token categories, 1000 sats each) burned in **one** transaction: 9 inputs, one `OP_RETURN`, no token, 583 bytes, 9000 sats to miners. The chipnet burner address was empty afterwards |
| BCH deposit | `9e2980d88a681ea04c896d24c8423a2669fab16d2834b9291c5f655b5c37a854` | XO action `depositSatoshis`: 1000 sats to the burner address, no token |
| Sweep | `c15cb9e5c168c711e9febfe02e60358e9c082d0af533112adaf2bf8f5aed281c` | XO action `burn`, started from the template’s `start` entry: 1 input, one `OP_RETURN` with 0 sats. The 1000 sats went to the miner as the fee |

The genesis is built with Libauth (`shared/chipnet-tokens.ts`), because XO has no token-genesis action. Everything else ran through the XO engine.
