# Badgers Stake

Stake BCH to earn BadgerCoins. A staker locks BCH in the BadgerStake contract for a number of blocks and earns **one BadgerCoin per BCH per block**. When the lock ends, anyone can release it: the BCH, the BadgerCoins and a "Honey" NFT receipt go back to the staker's address. A **masterBadger** minting NFT, held by the contract, carries the BadgerCoin supply, the staking fee and the admin's key hash.

This template wraps the **live BadgerStake contract unchanged**, so XO wallets stake into the same contract that [badgers.cash](https://badgers.cash) uses.

| | |
| --- | --- |
| Status | Tested offline (30 tests). Chipnet, on a test variant with our own category: masterBadger mint, `deploy` and `withdraw` verified 2026-11-18. `stake` and `unstake` are built and checked offline only (see Chipnet). Blaze Tool check pending. |
| Contract | [`BadgerStake.cash`](BadgerStake.cash), verbatim from upstream, rebuilt with cashc 0.10.0-next.4 (the upstream compiler). 461 bytes, 297 opcodes. |
| Address (mainnet) | `bitcoincash:rvgcl3xk6nwqlngkk09e7g67x5vxs57jv6v2q4qm4ct5yv4d3ppfgdzhpuxn8` (the masterBadger and 52 stake locks on 2026-11-18) |
| masterBadger category | `242f6ecedb404c743477e35b09733a56cacae34f3109d5cee1cbc1d5630affd7` (mainnet only) |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `f6fac1abcc477d72529694d397c4473428da0710ad8ceb7e1c02ed43a83369cf` |

## Credits

- **Contract and app:** BadgersStake by **SayoshiNakamario** ([SayoshiNakamario/BadgersStake](https://github.com/SayoshiNakamario/BadgersStake)), live at [badgers.cash](https://badgers.cash).
- **Source:** [`BadgerStake.cash`](https://github.com/SayoshiNakamario/BadgersStake/blob/49ccba8d1726d73919b584e1aa7ec5c63eea5479/BadgerStake.cash) at commit `49ccba8d` (2024-12-30). The artifact we compare against is upstream's `BadgerStake.json` (cashc 0.10.0-next.4) at the same commit. Upstream also publishes [`BadgersStake.op_codes.cash`](https://github.com/SayoshiNakamario/BadgersStake/blob/49ccba8d1726d73919b584e1aa7ec5c63eea5479/BadgersStake.op_codes.cash), the same contract annotated with its opcodes.
- **Licence:** **none stated.** The repository has no LICENSE file, and neither the README nor the source names one. The copy here is for verification and review, with attribution; ask the author before reusing it elsewhere.
- **Adapted by:** XOGrid, in this folder. Only the XO template is new. The contract is unchanged.

## Design

One contract with three functions and no constructor parameters. The masterBadger's token category is written into the bytecode three times.

| Function | Inputs | Outputs |
| --- | --- | --- |
| `lock(amount, stakeBlocks, pubkeyhash)` | **0:** masterBadger; **1:** the staker's P2PKH coin at `pubkeyhash` (exactly 2) | **0:** masterBadger + staking fee, BadgerCoins − reward; **1:** lock NFT (mutable, commitment `pubkeyhash ‖ 18 zero bytes ‖ stakeBlocks as 2 bytes`) with `amount` sats and the reward in BadgerCoins; **2 (optional):** change to the same P2PKH address |
| `unlock()` | **0:** a lock NFT, `tx.age >= stakeBlocks` (exactly 1) | **0:** the BadgerCoins (1000 sats); **1:** a Honey NFT (immutable, commitment `0000 ‖ reward as a VM number`, 1000 sats); **2:** the BCH less 3000 sats. All to the staker's P2PKH (exactly 3) |
| `withdraw(newFee)` | **0:** masterBadger; **1:** a coin at the admin's P2PKH, from the commitment (exactly 2) | **0:** masterBadger with 1000 sats and the new fee; **1:** the rest, less a 1000-sat fee, anywhere the admin signs for (exactly 2) |

The masterBadger commitment is 40 bytes: the staking fee (2 bytes), 18 zero bytes, and the admin's 20-byte key hash. The reward is `amount × stakeBlocks / 100,000,000`, at least 1.

### Why the contract is used unchanged

Changing a byte would move the contract away from the live masterBadger and the 52 open stakes on mainnet. Choices our house rules would usually flag, but that come with the deployed contract:

- **Fixed indices and exact input and output counts.** Every function checks `this.activeInputIndex == 0` and the exact layout, so it can't be combined with other contracts in one transaction.
- **A key, not a token, for admin rights.** The withdraw is authorised by a P2PKH coin at the admin's key hash.
- **Hard-coded satoshi amounts** (1000-sat payout dust, a 3000-sat release cost, a 2000-sat withdraw cost). The release fee is fixed at 1000 sats whatever fee rates do.
- **One masterBadger.** Every stake spends the same masterBadger, so stakes made at the same time contend for it; releases don't.

### Mapping into the template

| Contract | Template |
| --- | --- |
| Compiled bytecode | `scripts.badgerBytecode`, read from `artifact/BadgerStake.json` unchanged |
| Contract address | `lockingScripts.badgerLockingScript`, `lockingType: "p2sh"` (P2SH32) |
| The hard-coded category | constant `badgerCategory` (display byte order) for the token fields; a test checks it is the byte-reverse of the bytecode's copy |
| `lock()` | action `stake` → `stakeTransaction`: `masterStakeInput` (unlocking `<pubkeyhash> <stakeBlocks> <amount> <0>`) and `stakerCoinInput`; outputs `masterAfterStakeOutput`, `lockOutput`, `stakeChangeOutput` |
| `unlock()` | action `unstake` → `unstakeTransaction`: `lockInput` (unlocking `<1>`, `sequenceNumber: $(<stakeBlocks>)`); outputs `badgerCoinOutput`, `honeyOutput`, `unstakedOutput` |
| `withdraw(newFee)` | action `withdraw` → `withdrawTransaction`: `masterWithdrawInput` (unlocking `<newFee> <2>`) and `adminCoinInput`; outputs `masterAfterWithdrawOutput`, `withdrawOutput` (to `$(<withdrawLockingScript>)`) |
| Putting a masterBadger in the contract | action `deploy` (admin). Not a contract function: it moves a minting NFT into the contract, with the commitment the contract reads |

**The values.** XO output values can't read input values, so each action asks for the values of the coins it spends: the masterBadger's satoshis, BadgerCoins and commitment; the staker's coin value; the lock's satoshis and BadgerCoins. Every output is then computed with the contract's own formulas. Wrong values can't move anything the contract doesn't allow: the contract rejects the spend.

**Commitments as hex text.** The engine evaluates token fields as text: a string variable is pushed as its UTF-8 text, and the result is read back as hex. The template therefore builds the lock, Honey, deploy and withdraw commitments as hex text, with helper scripts that turn numbers into hex digits and back (`hexUint16LE`, `binToHexText`, `hexTextToUint16LE`). `binToHexText` uses the BCH 2026 loop opcodes. Tests check every helper and every commitment against the contract's bytes.

**Change.** The contract requires a stake's change to go back to the staker coin's own address. The engine's automatic change would go to a fresh address and be rejected, so the template builds the change itself (`stakeChangeOutput`). That output pays the coin's value less the stake, the staking fee and a fixed `stakeMinerFeeSatoshis` of 1700, about 2 sats per byte; a test checks it covers the signed transaction's size. Clients must not add change to any of the three spends.

**Guards.** The engine refuses to build a stake below 5000 sats, a period outside 1–32767 blocks, a reward below 1 or above the masterBadger's supply, change below the 546-sat dust limit, or a fee outside 0–32767.

Roles: `staker` stakes and releases (anyone may release; the payout always goes to the staker), and `admin` deploys and withdraws. The masterBadger and the locks have zero balance and `selectable: false`. The staker's P2PKH outputs are marked not relevant here, because the wallet already tracks them through its P2PKH template.

## Safety notes

- **Staked BCH is locked** until `stakeBlocks` have passed. Releasing costs 3000 sats of it: 1000 on each payout token output and a 1000-sat fee.
- **The staker's coin must be at a P2PKH address.** Its key hash becomes the payout address, written into the lock NFT.
- **The admin key matters.** Whoever controls the key hash in the masterBadger commitment can collect the staking fees and change the fee (from 0 to 32767 sats), but cannot touch the BadgerCoin supply or anyone's stake.

## Findings to share upstream

- **The lock period tops out at 32767 blocks, not 65536.** The contract checks `stakeBlocks <= 65536`, but stores the period with `bytes2(stakeBlocks)`, which fails for 32768 and above (a 2-byte VM number is signed). `test/contract.test.ts` shows both. Our template caps the period at 32767.
- **Upstream's artifact `debug.bytecode` isn't the deployed script.** It is cashc's 530-byte debug build. The 461-byte `bytecode` ASM is what lives at the badgers.cash address.
- **Stray chipnet masterBadger.** On chipnet, a minting NFT of another category (`2c68a790…`) sits at the mainnet contract's address. The contract only accepts the hard-coded mainnet category, so that coin can never be spent.

## XO engine notes (engine 0.1.1-next.18029697917)

- **Constants can't be used in locking or unlocking scripts.** The engine's script compiler only declares template variables, so a constant there fails with "Unknown identifier". Constants do work in value expressions and token fields.
- **`<0x>` is read as a variable named `x`.** Use `OP_0` for an empty push.
- **Token fields are evaluated as text** (see "Commitments as hex text"). Loop opcodes work in these expressions.
- **The engine's change goes to a fresh address**, so a contract that requires change at the input's own address needs the change built by the template, with automatic change off.
- **Tracking, again.** The engine only unlocks contract coins it tracks. `deploy` makes the admin's wallet track the contract. A staker's wallet starts tracking it after its first stake; that first stake from a fresh wallet needs the masterBadger's unlocking supplied by a `mergesWith` commit (see drip-mine/README.md).

## Tests

```bash
cd contracts && npm test
```

- `test/contract.test.ts` (17 tests, Libauth VM with real token data and signed P2PKH coins).
  - `lock`: accepts a stake with and without change and at 32767 blocks; rejects a reward one too high, too small a stake or reward, a coin not at the staker's key hash, change to another address, and a stake that skips the fee.
  - `unlock`: accepts a release after the period; rejects one before it, to anyone else, or with a wrong Honey commitment.
  - `withdraw`: accepts the admin; rejects a stranger's signature and a commitment that swaps the admin.
  - The findings: periods of 32768 and 65536 fail; a release needs no signature but pays only the staker.
- `test/template.test.ts` (13 tests).
  - Rebuilding with cashc 0.10.0-next.4 reproduces the artifact, the address is badgers.cash's, and the `badgerCategory` constant matches the bytecode.
  - The hex-text helpers match the contract's encodings, and every commitment the template builds is checked against the bytes.
  - Stakes (three sizes, up to 32767 blocks), a release and a withdrawal, all built from template outputs, pass the VM; the stake's miner fee covers its signed size; the guards refuse bad stakes.
  - `template.json` is current, the identifier is stable, and the registry audit reports no failures.

## Chipnet

The real contract only accepts the mainnet masterBadger category, so `scripts/chipnet.ts` runs a **test variant**: the same contract and template with our own test category in both the bytecode and the `badgerCategory` constant. It has its own address and template identifier (`c5ca9687…c5f9`).

```bash
cd contracts
npx tsx badgers-stake/scripts/chipnet.ts mint       # test masterBadger genesis (Libauth): minting NFT + supply, to our admin address
npx tsx badgers-stake/scripts/chipnet.ts deploy     # XO action deploy
npx tsx badgers-stake/scripts/chipnet.ts withdraw   # XO action withdraw
npx tsx badgers-stake/scripts/chipnet.ts stake      # XO action stake: needs one coin of about 7,300 sats or more
npx tsx badgers-stake/scripts/chipnet.ts unstake    # XO action unstake, after the lock period
```

| Step | Transaction | What happened |
| --- | --- | --- |
| Minter funding | `eb2d5edf0815f10f8cc3a158707e7a9e732a162c147bcef2ecc30caff311e899` | 3500 sats to the minter key (p2pkh template) |
| masterBadger genesis | `f50efe845a69f9b4a15cbd22138580cba805ed99587d324c7235ef08864e64ff` | A minting NFT of category `eb2d5edf…` with 21,000,000,000,000 BadgerCoins and 1000 sats, plus a 2000-sat admin coin, to our admin address |
| Deploy | `91a29cbc00adfc735f93ec94fdc8fb1da6f5e94451492b5120d4ea66ebb62d1c` | XO action `deploy`: the masterBadger into the variant contract, commitment `6400` (fee 100) ‖ 18 zero bytes ‖ our admin key hash |
| Withdraw | `5e4291d7f82cc77a17bf587b9b675188d19adf9e6446819c9fef6a8abf6bd95b` | XO action `withdraw`, authorised by the admin coin: the masterBadger kept 1000 sats and its key hash, its fee became `fa00` (250), and 1000 sats went to the admin (1000 + 2000 − 2000). 824 bytes, 1000-sat fee |
| Stake, release | not run | A stake needs a single coin of about 7,300 sats (5000 staked, the fee, ~1700 to miners, change), which the test wallet doesn't have; and a 5000-sat stake must last 20,000 blocks to earn a BadgerCoin |

Runs on 2026-11-18. Everything except the genesis ran through the XO engine. Mainnet was not touched.
