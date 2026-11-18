# Drip Mine

An MEV faucet. BCH sent to the shared Drip Mine address is released to miners a little at a time. Once per block, anyone can spend a Drip Mine coin back to the same address minus a small payout, and that payout is the transaction fee, so it goes to whichever miner mines it: miner extractable value. Nothing ever comes back to the funder or to the person who posts the drip.

This template wraps the **live Drip Mine contract unchanged**, so XO wallets fund and drip the same address that [vox.cash/drip](https://vox.cash/drip) shows.

| | |
| --- | --- |
| Status | Chipnet verified (fund, drip, terminate, all on 2026-11-17). 26 offline tests. Blaze Tool check pending. |
| Contract | [`drip-mine.cash`](drip-mine.cash), verbatim from upstream, rebuilt with cashc 0.9.3. 52 opcodes, 68 bytes. |
| Redeem script | `51b275c3519dc4519d02400202a400c0c67b527993a063c0c7c0cd88c0c60228119504c685744f966ea063787768c0c6c0cc946ea2696d67c0cc009dc0cd016a88687551` |
| Address (mainnet) | `bitcoincash:pwsu8f4ftnsugunzy8wruhuayvtpz9mt88euwvwtp5jvv58wnd95c0td3wpdp` |
| Address (chipnet) | `bchtest:pwsu8f4ftnsugunzy8wruhuayvtpz9mt88euwvwtp5jvv58wnd95cvvu0kjcn` |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `6bb0264bc0b34a131ede0b90f77aeebc43f31f1a4ec600a61d7cc75d806d74bc` |

## Credits

- **Contract:** Drip Mine by **bitcoincashautist** (GitLab [ac-0353f40e / 0353F40E](https://gitlab.com/0353F40E)). [`drip-mine.cash`](https://gitlab.com/0353F40E/drip-mine/-/blob/5893d50ee9a531e0a31c6a637c3f2213509e8c02/drip-mine.cash) in [0353F40E/drip-mine](https://gitlab.com/0353F40E/drip-mine), commit `5893d50e` (2025-01-16).
- **Licence:** [MIT No Attribution](https://gitlab.com/0353F40E/drip-mine/-/blob/5893d50ee9a531e0a31c6a637c3f2213509e8c02/license), "Copyright (c) 2025 ac-0353f40e (aka bitcoincashautist)". MIT-0 doesn't require the notice; we credit the author anyway.
- **App and wallet template:** [vox.cash/drip](https://vox.cash/drip) by **2qx** ([2qx/vox](https://github.com/2qx/vox), Unlicense), at commit [`a7f970e4`](https://github.com/2qx/vox/tree/a7f970e40b43080ab8378a0f445f3368ce6792ac) (2026-10-03). Its copy, [`contracts/unspent/drip.v3.cash`](https://github.com/2qx/vox/blob/a7f970e40b43080ab8378a0f445f3368ce6792ac/contracts/unspent/drip.v3.cash), adds an attribution header and renames the function to `drip()`. With only one function there is no selector, so it compiles to the same bytecode. Its Libauth wallet template [`packages/drip/src/template.v3.json`](https://github.com/2qx/vox/blob/a7f970e40b43080ab8378a0f445f3368ce6792ac/packages/drip/src/template.v3.json) hand-writes the same script; this XO template is new.
- The drip-mine README credits 2qx's earlier [perpetuity contracts](https://unspent.app/documentation#perpetuity) as the inspiration, and 2qx reviewed the design.
- **Adapted by:** XOGrid, in this folder. Only the XO template is new. The contract is unchanged.

## Design

One contract, one function (`DripOrTerminate()`), and no constructor parameters, so every funding shares one well-known address. Each coin there is independent: a tiny recursive covenant.

| Rule in the contract | Why |
| --- | --- |
| `require(tx.age >= 1)` (`1 OP_CHECKSEQUENCEVERIFY`) | Each coin drips at most once per block. The spending input needs sequence number 1 and the transaction version 2. |
| Exactly 1 input and 1 output | The whole difference is the fee, so the miner gets it and nobody else can. |
| Coin > 740 sats (`dustLimit 576 + minPayout 164`): output `i` returns to the same address, paying at most `max(coin × 4392 / 1333036486, 164)` | Exponential decay with a half-life of about four years; 164 sats is the drip's own size at 1 sat/byte, so every drip relays. |
| Coin ≤ 740 sats: output `i` is exactly `6a` (bare `OP_RETURN`) with 0 sats | The coin is paid out whole and ends, so no coin is ever left below the dust limit. |

Transaction layouts:

| Transaction | Inputs | Outputs |
| --- | --- | --- |
| Fund (XO `fund`) | the funder's coins | `fundingOutput` at the Drip Mine address, plus the funder's change |
| Drip (XO `drip`) | **one** Drip Mine coin, sequence 1 | **one** output, index 0: `dripRemainderOutput`, the coin minus the payout, back at the Drip Mine |
| Terminate (XO `terminate`) | **one** Drip Mine coin of 740 sats or less, sequence 1 | **one** output, index 0: `terminalOutput`, `OP_RETURN`, 0 sats |

### Why the contract is used unchanged

Changing even one byte would change the address, which would split XO drips away from vox.cash/drip and from the coins already funded there. Three choices our house rules would usually flag are deliberate, and are the contract's security properties:

- **Exact input and output counts.** With one input and one output, the fee is exactly what the contract released, and no one can attach a change output to capture it.
- **Hard-coded dust limit and fee floor (576, 164).** Our rules say not to bake in network policy. Here the values only shape the decay and the hand-off to termination; a future lower dust limit would leave coins terminating a little early, never stuck.
- **One shared address.** Drips of different coins never collide, because each coin drips alone. Two people dripping the *same* coin in the same block race, and the first wins; the loser's transaction is simply rejected.

### Mapping into the template

| Contract | Template |
| --- | --- |
| Compiled bytecode (no constructor parameters) | `scripts.dripMineBytecode`, read from `artifact/DripMine.json` |
| Contract address | `lockingScripts.dripMineLockingScript`, `lockingType: "p2sh"` (P2SH32) |
| `DripOrTerminate()`, drip branch | action `drip` → `dripTransaction` → input `dripMineInput` (empty unlocking script, `sequenceNumber: 1`) and output `dripRemainderOutput` |
| `DripOrTerminate()`, terminate branch | action `terminate` → `terminateTransaction` → the same input and `terminalOutput` → `terminalLockingScript` (`OP_RETURN`) |
| `dustLimit`, `minPayout`, `4392 / 1333036486` | `constants`, used only in value expressions; a test checks they are the numbers in the redeem script |
| Funding | `start` action `fund` |

**The payout.** XO output values are computed from variables, and can't read the value of the coin being spent. So `drip` and `terminate` ask for the coin's value as `dripCoinSatoshis`. `dripRemainderOutput` is `dripCoinSatoshis − dripPayout`, where `dripPayout` is the contract's own `maxPayout` (same integer maths, floor division). The template always takes the full allowed payout, which a test proves is exact: one more satoshi is rejected. A wrong `dripCoinSatoshis` can't cost anyone money. The contract rejects the spend and the node refuses it.

**Guards.** Value expressions fail, so the engine refuses to build the output, for funding below the 576-sat dust limit (`checkFunding`), a drip of a coin that must terminate (`checkDripCoin`), and a termination of a coin that must drip (`checkTerminalCoin`).

Roles: `funder` gives BCH, and `dripper` (anyone) posts drips and terminations. Drip Mine coins have zero balance and `selectable: false`, so a wallet never counts them as its own funds or spends them for anything else.

## Safety notes

- **Funding is a gift to miners and can't be taken back.** A coin of 577–740 sats is paid out whole at its next spend. Larger coins drip slowly: 1 BCH releases about 329 sats per drip at first.
- **The dripper gains nothing** unless they mine the block. Posting a drip costs nothing either: the fee comes out of the coin.
- **One coin per transaction.** A batch of Drip Mine coins is rejected by every coin in it (tested), so a drip bot posts one transaction per coin.
- **Timing.** A coin must be at least a block old. A node one block behind may reject a drip as `non-BIP68-final` for a coin that is already confirmed; send the same transaction again a minute later.

## Findings to share upstream

- The drip-mine README, under *Drip*, says the output's value must be `max(input_value * 4392 / 1333036486, 164)`. That is the payout (the fee); the output's value is the coin **minus** it.
- vox's `Drip.getOutput` pays `round(value × 4392 / 1333036486) − 1`, at least 164. That's up to 1 sat under the contract's limit, which is harmless but leaves the miner a satoshi.

## XO engine notes (engine 0.1.1-next.18029697917)

- **`sequenceNumber` on a template input works.** The engine set sequence 1 on both chipnet spends, and the CSV check passed.
- **Tracking a busy shared address is heavy.** A wallet starts watching the Drip Mine address when it funds it (as with Token Burner). On chipnet that address has 514 coins and a history of **44,816 transactions**. Our version of `@electrum-cash/application` fetches and verifies every transaction in a tracked address's history. After funding, engine start-up hit Electrum `Connection lost` and `SQLITE_BUSY` errors several times before it came up, and logged many `Failed to process transaction update` errors. The drip broadcast went through but was reported as `Connection lost`. A day later the wallet could no longer start at all. The engine has no API to stop watching an address, so on 2026-11-18 we deleted the Drip Mine script hash and its 514 coin records from the test wallet's state database by hand (a backup is in `.xo-demo/backup-2026-11-18`); the wallet then started in seconds. Run the Drip Mine chipnet script from a separate wallet, or expect to repeat that clean-up. On mainnet the address has 18 coins.
- **After a failed broadcast the coin stays reserved.** Signing the same invitation again is refused (`InvitationItemFieldConflictError`), but `executeAction` broadcasts the stored transaction again. `scripts/chipnet.ts rebroadcast <invitation>` does this.
- As with Token Burner, `omitChangeAmounts` and `composable` aren't read; the client must not add change, and `scripts/chipnet.ts` doesn't.

## Tests

```bash
cd contracts && npm test
```

- `test/contract.test.ts` (13 tests, Libauth VM).
  - Accepts the full proportional payout, a smaller payout, the flat 164-sat payout, the smallest drippable coin (741 → 577) and terminations at 740 and 576.
  - Rejects a payout 1 sat too high, a missing timelock (sequence 0 or final), the remainder sent elsewhere, a second output, two coins at once, terminating a coin that must drip, dripping a coin that must terminate, and terminal outputs other than a bare 0-sat `OP_RETURN`. Each rejection is asserted to come from the contract itself.
- `test/template.test.ts` (13 tests).
  - Rebuilding with cashc 0.9.3 reproduces the artifact, and the redeem script, lock and both addresses match the published ones; the constants are the numbers the redeem script embeds.
  - Funding, drip and terminal outputs resolve through the engine's own `completeMergedOutput`, the guards refuse wrong amounts, and the engine's `completeMergedInput` gives the input sequence number 1.
  - Drips built from the template pass the VM for coins from 741 sats to ~1000 BCH, each at the exact maximum payout, and a drip is 164 bytes.
  - `template.json` is current, the identifier is stable, and the registry audit reports no failures.

## Chipnet

```bash
cd contracts
npx tsx drip-mine/scripts/chipnet.ts fund        # XO action fund: 700 sats (FUND_SATS) to the Drip Mine
npx tsx drip-mine/scripts/chipnet.ts drip        # XO action drip on the smallest confirmed coin above 740 sats
npx tsx drip-mine/scripts/chipnet.ts terminate   # XO action terminate on a coin of 740 sats or less
npx tsx drip-mine/scripts/chipnet.ts rebroadcast <invitation>   # resend a stored, signed spend
```

`DRIP_OUTPOINT=<txid>:<index>` picks the coin. Runs on 2026-11-17 with template `6bb0264b…74bc`:

| Step | Transaction | What happened |
| --- | --- | --- |
| Fund | `d852820db7f240b1f9635f5c83962dbcd45ab4fcefa5ec564d94b2d9ddc1be8e` | XO action `fund`: 700 sats to the Drip Mine address |
| Drip | `398bf8578d112b028bf2623bfe6a045d83ec5a087e38fa25d1f5cb6d37e9c710` | XO action `drip` on someone else's 99,968,835-sat coin: version 2, 1 input (sequence 1), 1 output of 99,968,506 sats back to the Drip Mine, 164 bytes, **329 sats to the miner** |
| Terminate | `388d4dc36cdf816fba5099298c01f6e5c7e326fac56d0b8947d3e122bc7992f4` | XO action `terminate` on the 700-sat funding: 1 input (sequence 1), one `OP_RETURN` (`6a`) with 0 sats, 130 bytes, all 700 sats to the miner. The first broadcast was rejected as `non-BIP68-final`; the same stored transaction went through on `rebroadcast` |

Everything ran through the XO engine. Mainnet was not touched.
