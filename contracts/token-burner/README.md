# Token Burner

Provably burn CashTokens. Anyone can send tokens to the shared TokenBurner address. Anyone can then destroy them in a transaction whose only output is an `OP_RETURN` farewell message. Burns are final, and the satoshis sent with the tokens go to miners.

This template wraps the **live TokenBurner contract unchanged**, so XO wallets burn into the same address that [tokenburner.cash](https://www.tokenburner.cash/) shows, and their burns appear in its feed.

| | |
| --- | --- |
| Status | Chipnet verified (mint, deposit, burn on 2026-11-16). 18 offline tests. Blaze Tool check pending. |
| Contract | [`burner.cash`](burner.cash), verbatim from upstream, rebuilt with cashc 0.9.3 (the upstream compiler). 13 opcodes, 15 bytes. |
| Redeem script | `c4519d00d10088016a00cd517f7587` |
| Address (mainnet) | `bitcoincash:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlc2s5qtune` |
| Address (chipnet) | `bchtest:r0lxr93av56s6ja253zmg6tjgwclfryeardw6v427e74uv6nfkrlcfh97n0xt` |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `2fb462ac7c3e545d7055c68d8b47a935379e40f330919ed99b822885360acb1d` |

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
| Sending tokens to the burner | `start` actions `depositFungibleTokens` and `depositNonfungibleToken` |

Roles: `depositor` sends tokens, and `burner` (anyone) destroys them. A depositor who tracks the burner output for the `burner` role can burn it themselves. Burner coins have zero balance and `selectable: false`, so a wallet never counts them as its own funds or spends them for anything else.

## Safety notes

- **Burns are irreversible**, and anyone can burn anything sent to the address, including someone else's deposit. The descriptions say so.
- **The satoshis in a burner coin go to miners.** A token output needs some (about 1000 sats). Don't send more than that.
- **Only one output.** A burn can't take change, and the engine must not add any. The template marks `burnTransaction` as `composable: false` and sets `omitChangeAmounts` on `burnerInput`. Engine 0.1.1-next reads neither field (see below), so a client must not add change itself, as `scripts/chipnet.ts` shows.
- **Farewell messages** are limited to 220 bytes by `OP_RETURN` standardness rules, the same limit tokenburner.cash uses. An empty message still produces `OP_RETURN OP_0`, which the contract accepts.

## Finding to share upstream

When no farewell message is entered, the tokenburner.cash frontend (`js/mint.ts` at `f2024075`) builds a burn with **zero outputs**. Consensus rejects that ("transactions must have at least one output"), and the contract would reject it anyway, because it requires `tx.outputs.length == 1`. A bare `OP_RETURN` (`6a`) output fixes it. `test/contract.test.ts` shows both cases. This doesn't affect the template, which always adds the `OP_RETURN` output.

## XO engine notes (engine 0.1.1-next.18029697917)

- `omitChangeAmounts` on inputs and `composable` on transactions are in the schema, but the engine doesn't read them. The client decides whether to add change.
- The engine builds and broadcasts a transaction that destroys tokens and pays the whole coin as fee, with no extra guard. The chipnet burn below confirms this.

## Tests

```bash
cd contracts && npm test
```

- `test/contract.test.ts` (9 tests, Libauth VM with real token data).
  - Accepts burning fungible tokens with a message, a bare `OP_RETURN`, an NFT, and several burner coins at once.
  - Rejects an extra change output, a P2PKH output that takes the satoshis, an `OP_RETURN` that keeps the tokens, and an output that doesn't start with `OP_RETURN`. Each rejection is asserted to come from the contract itself.
  - Shows that consensus rejects a zero-output burn.
- `test/template.test.ts` (9 tests).
  - Rebuilding with cashc 0.9.3 reproduces the artifact, and the template's redeem script and address match the published ones.
  - Fungible and NFT deposits resolve through the engine's own `completeMergedOutput`.
  - The farewell output matches tokenburner.cash's format, and a burn built from template pieces passes the VM.
  - `template.json` is current, the identifier is stable, and the registry audit reports no failures.

## Chipnet

```bash
cd contracts
npx tsx token-burner/scripts/chipnet.ts mint      # creates a test token in the XO test wallet
npx tsx token-burner/scripts/chipnet.ts deposit   # XO action depositFungibleTokens
npx tsx token-burner/scripts/chipnet.ts burn      # XO action burn
```

Run on 2026-11-16 with template `2fb462ac…cb1d`:

| Step | Transaction | What happened |
| --- | --- | --- |
| Minter funding | `0b7ed51a5de73071512ea4f17eeeb1f8a3d6796de3f5ce322e6da750820fe4b4` | XO wallet paid 3000 sats to the minter key (p2pkh template) |
| Token genesis | `7422e54bf6122972a296114d9deee6866c8768e0d51e1acbd3f3b639027932c6` | 1,000,000 units of category `0b7ed51a…e4b4` to the XO wallet |
| Deposit | `fcd0b5fc8435f068ec0a68fd7d5dc2ae1eff8ae1d77e702708cd119d4f880da9` | 250,000 tokens with 1000 sats to the burner; 750,000 tokens back as token change |
| Burn | `3ee700053e66a324a91415e9d80242a7c701ef0f4598769d134378322f721065` | One input, one output: `OP_RETURN "XOGrid test burn via the Token Burner XO template"`, no token. 250,000 tokens destroyed |

The genesis is built with Libauth (`shared/chipnet-tokens.ts`), because XO has no token-genesis action. Everything else ran through the XO engine.
