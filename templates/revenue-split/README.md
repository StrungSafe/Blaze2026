# Revenue Split

Lock satoshis so they can only be paid out to three fixed recipients (artist, collaborator, platform) at fixed percentages. Anyone can trigger the payout; the trigger pays the miner fee and cannot keep any of the split.

| | |
| --- | --- |
| Status | Chipnet verified (fund and payout, 2026-11-16, with the earlier identifier `9674cee2…`; see below). 23 offline tests. Blaze Tool check pending. |
| Contract | [`RevenueSplit.cash`](RevenueSplit.cash), cashc 0.14.0, 89 bytes of contract code, 62 opcodes |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `b17ba2ee55b392f959155a9b86d58137ebfef783041c092496ddb887f9d8654e` |
| Chipnet (identifier `9674cee2…`) | fund: `d155dec1716cc44305891fdaa9bf17ec39d3501b4c37cccc1f25b4a37ecd2329` · payout: `d44ca959a6cd8e6d9e4cfd450a08257df8d0e173dc7dc04f0c9040bb99d56fab` |

## Credits

- **Original draft:** [`contracts/RevenueSplit.cash`](https://github.com/XOGrid-Cash/Blaze2026_XOGrid/blob/8267aec7042fac07662ec5b2e765643d834fa127/contracts/RevenueSplit.cash) by **angelnath**, XOGrid commit `8267aec` (2026-10-31), written for the music-streaming proposal in [`docs/PROPOSAL.md`](../../docs/PROPOSAL.md). It is part of this repository and is covered by the repository [LICENSE](../../LICENSE).
- **Finished and converted to XO:** this folder. The changes are listed below.

## Design

One contract, one function. Each payment is its own coin, so concurrent payers never contend for a shared UTXO.

Transaction layout, relative to the split coin's input index `i`:

| Position | Holds | Constrained by |
| --- | --- | --- |
| input `i` | the split coin | the contract |
| output `i` | artist share: `total × artistBasisPoints / 10000` to P2PKH(artist) | the contract |
| output `i + 1` | collaborator share: `total × collaboratorBasisPoints / 10000` to P2PKH(collaborator) | the contract |
| output `i + 2` | platform share: the rest, including the rounding remainder, to P2PKH(platform) | the contract |
| everything else | the trigger's fee input(s), change, other contracts | nothing |

The template always places the split coin at input 0, so its shares are outputs 0 to 2. The engine adds the trigger's fee input and change after them.

**Batching:** a transaction can pay out several split coins, as long as their output windows don't overlap. A coin at input `k` uses outputs `k` to `k + 2`, so split coins have to sit at least three inputs apart, with fee inputs in between. Coins at inputs 0 and 1 can't share outputs, because one output can't be both the collaborator (for coin 0) and the artist (for coin 1). A test covers this case.

### Mapping into the template

| Contract | Template |
| --- | --- |
| Constructor `artistPublicKeyHash`, `collaboratorPublicKeyHash`, `platformPublicKeyHash` | `bytes` variables, passed as **hex** |
| Constructor `artistBasisPoints`, `collaboratorBasisPoints` | `integer` variables |
| Compiled bytecode | `scripts.revenueSplitBytecode`, read from `artifact/RevenueSplit.json` |
| Redeem script | `<collaboratorBasisPoints> <artistBasisPoints> <platformPublicKeyHash> <collaboratorPublicKeyHash> <artistPublicKeyHash> revenueSplitBytecode` (CashScript's reversed order) |
| Contract address | `lockingScripts.revenueSplitLockingScript`, `lockingType: "p2sh"` (P2SH32) |
| `Payout()` | action `payout`, transaction `payoutTransaction`, input `splitInput` with an empty unlocking script (only one function, so no selector) |
| Funding the contract | `start` action `fundSplit` |
| Share outputs | `artistShareOutput`, `collaboratorShareOutput`, `platformShareOutput`; values computed with the contract's integer maths |

Roles: `payer` funds a split, and `trigger` pays one out. Recipients aren't roles, because they never act: each share is a plain P2PKH payment that their usual wallet sees.

## Changes from the original draft

| Change | Why |
| --- | --- |
| Removed the fixed 1000-sat miner fee taken from the coin. The coin is split 100%, and the trigger pays the fee from their own input. | A fixed fee can't follow fee-rate changes. It also let the trigger choose how much of the split went to miners. |
| Shares are found at outputs `i`, `i + 1`, `i + 2` relative to the contract's input, instead of fixed outputs 0 to 2. The exact `tx.outputs.length == 3` check is gone. | The trigger needs a change output, and the coin can now share a transaction with other contracts. |
| Renamed parameters to whole words (`artistPublicKeyHash`, `artistBasisPoints`, …), renamed the function to `Payout`, and added `pragma cashscript ^0.14.0`. | House naming style and pinned compiler version. |
| Recipients stay P2PKH-only (`bytes20` key hashes). | Design choice: a smaller script. Shares can't go to contract addresses. |

## Safety notes

- **Bad parameters lock coins forever.** A negative basis-point value, a sum over 10000, or a key hash that isn't 20 bytes makes `Payout()` impossible to satisfy. A check inside the contract can't rescue coins that are already locked. The template therefore checks before funding: `splitOutput.valueSatoshis` runs `checkSplitParameters`, and fails to compile on bad values, so the engine refuses to build the funding output. Tests cover each case.
- **Dust:** a share below the dust limit (546 sats) makes the payout non-standard, so it won't relay. Fund splits large enough that every share clears 546 sats, for example at least 3,640 sats for a 15% share. The payout action's description says this.
- **CashTokens** sent to a split address by mistake are not protected: whoever triggers the payout can take them.
- **Front-running:** none to worry about. Anyone can trigger, but every valid payout pays the same recipients the same amounts.

## XO engine notes (engine 0.1.1-next.18029697917)

- **Action `conditions` are not evaluated.** The schema accepts them, but the engine never reads them, so they can't guard an action. This template guards funding inside an output value expression instead.
- **`bytes` variables are encoded differently in two places.** Locking and unlocking scripts get the decoded bytes, because the engine reads hex according to the variable's type. CashASM value expressions (`valueSatoshis`, descriptions) get the UTF-8 text of the hex: a 20-byte key hash arrives there as 40 bytes. `checkKeyHashSize` accepts either size. A test pins the current behaviour, so a future engine change will be noticed. Worth reporting to the XO team.

## Tests

```bash
cd templates && npm test
```

- `test/contract.test.ts` (9 tests, CashScript SDK). Checks a correct payout with trigger change, rounding, a short share, swapped recipients, a missing share, a trigger skimming a fee, a split coin behind other inputs, batching with non-overlapping windows, and that overlapping windows are rejected.
- `test/template.test.ts` (14 tests). Also checks that the committed `template.json` is current, with bigints in XO extended-JSON form. Checks the canonical identifier, that the redeem script and P2SH32 lock are byte-identical to CashScript's for four parameter sets, P2PKH recipient scripts, share maths, a VM-verified payout built from the template (and rejected variants), the funding guard (valid case plus five invalid ones), the engine encoding note, and the registry audit with no failures.

## Chipnet

**Identifier change after the chipnet run.** The run used identifier `9674cee2…`. That `template.json` stored `balance.satoshis` as the plain string `"0n"`, because our JSON step didn’t use XO’s extended-JSON bigint format (`<bigint: 0n>`). The fix changed only those two balance fields. The redeem script, locking bytecode, actions and values are identical, and the equivalence tests pass unchanged. A re-run with the current identifier needs about 5,000 more chipnet sats in the test wallet.

```bash
cd templates
npx tsx revenue-split/scripts/chipnet.ts fund     # first run prints a chipnet address to fund
npx tsx revenue-split/scripts/chipnet.ts payout
```

**Known chipnet warning (since chipnet's 2026-11-15 upgrade):** `Failed to synchronize block headers … claims target 486604799, expected 437753688`. `@electrum-cash/checkpoint` 0.7.2 still validates chipnet with 600-second blocks (`asertIdealBlockTimeInSeconds: 600`). The rejected header claims the minimum-difficulty target `0x1d00ffff`, which testnet rules allow after a gap of 2 × the block time. That is 2 minutes under 1-minute blocks, but 20 minutes under the library's rules. So header sync stops near height 332,384, and the engine can't confirm newer transactions ("ahead of the current checkpoint"). Broadcasting and coin lookups still work, as the transactions above show. Mainnet is unaffected. The fix belongs upstream, in the chipnet parameters of `@electrum-cash/checkpoint`.

The script uses its own test wallet in `templates/.xo-demo` (gitignored). The three recipients are fresh addresses of that same wallet, so every share comes back to it. Executed invitations are saved next to the wallet, ready for the Blaze Tool.
