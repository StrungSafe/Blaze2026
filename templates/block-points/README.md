# Block Points

A coin-age reward vault. Tokens deposited into the shared BlockPoints vault can be claimed by anyone, at **one token per BCH per block** that one of their coins has been held unmoved. Moving a coin resets its age. The vault releases the BPTS reward token on [vox.cash/bpt](https://vox.cash/bpt), and works the same way for any fungible token deposited there.

This template wraps the **live BlockPoints vault unchanged** (the latest version, v3.2), so XO wallets claim from the same threads that vox.cash/bpt shows.

| | |
| --- | --- |
| Status | Tested offline (27 tests). Chipnet: thread funding verified on 2026-11-18. The claim is built and checked offline only; a chipnet claim was skipped, because it needs a test coin large enough to earn a token (see Chipnet). Blaze Tool check pending. |
| Contract | [`upstream/template.v3.2.json`](upstream/template.v3.2.json), script `lock`: hand-written CashASM, verbatim from upstream. 48 bytes. |
| Redeem script | `c2529d03ffff0078a26900cb78a26976b275c0d3c0d07b00c6950400e1f5059694a269c0d1c0ce88c0cdc0c788c0519c` |
| Address (mainnet) | `bitcoincash:rvlnj38vup2zgng7dg0jqz8cx6up9ucrdde3tejs2vx2ycxjmm5nckv9qk23t` (337 BPTS threads) |
| Address (chipnet) | `bchtest:rvlnj38vup2zgng7dg0jqz8cx6up9ucrdde3tejs2vx2ycxjmm5nc4t57weye` (127 tBPTS threads) |
| Token | BPTS `c7ea26912c147b521ad956cf64461d844c3239d382ac6f7072dc43725247dc76` (mainnet), tBPTS `10608586e070bbea7142435775f79161751972f180f64752bae974dbe023ebc3` (chipnet) |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `9941f723c962e64956c5dcbc9e97e6a735736e4a8e94b24d7d77e6b0eeee3e5a` |

## Credits

- **Contract and app:** Block Points by **2qx** ([2qx/vox](https://github.com/2qx/vox)), at commit [`a7f970e4`](https://github.com/2qx/vox/tree/a7f970e40b43080ab8378a0f445f3368ce6792ac) (2026-10-03). The vault script is the `lock` script of [`packages/blockpoint/src/template.v3.2.json`](https://github.com/2qx/vox/blob/a7f970e40b43080ab8378a0f445f3368ce6792ac/packages/blockpoint/src/template.v3.2.json), the version the app (`packages/blockpoint/src/index.ts`) uses.
- **Licence:** the repository's [LICENSE](https://github.com/2qx/vox/blob/a7f970e40b43080ab8378a0f445f3368ce6792ac/LICENSE) is the Unlicense (public domain). `packages/blockpoint/package.json` says ISC; both are permissive. We credit the author either way.
- **Adapted by:** XOGrid, in this folder. Only the XO template is new. `upstream/template.v3.2.json` is an unmodified copy, and the template embeds its `lock` script text as-is, comments included.

### Which version is live

vox ships several versions, and only v3.2 matches the live vault:

| Upstream file | Address | Coins (2026-11-18) |
| --- | --- | --- |
| `contracts/unspent/blockpoint.v3.cash` and `blockpoint.json` (cashc 0.11) = `template.v3.json` | `r0ak899w…` | none on mainnet; 125 old test threads on chipnet |
| `template.v3.1.json` (age cap 500,000,000) | `r06fp2k6…` (the address `address.test.ts` still expects) | 127 threads of an older test token on each network |
| **`template.v3.2.json`** (age cap 65535, version, category and bytecode checks, fixed input 1) | **`rvlnj38v…`** | **337 BPTS threads on mainnet** (funded in `5e9f4a5a…6ae1`), **127 tBPTS on chipnet** |

There is no `.cash` source for v3.2: it is hand-written CashASM with the intended CashScript written in comments. So this folder has no `.cash` file and no artifact. The test suite instead checks that the embedded script is byte-for-byte upstream's and compiles to the live redeem script and both addresses.

## Design

One contract, no constructor parameters, one function `release(int age)`. Each coin at the vault address is a **thread** holding one token category, and threads are independent: 337 of them let up to 337 claims land in the same block.

```
// release(int age)  — from the comments in upstream's script
require(tx.version == 2);
require(65535 >= age);                                   // a block-based relative timelock fits in 16 bits
require(tx.inputs[0].sequenceNumber >= age);             // the claimant's coin, at input 0
require(tx.age >= age);                                  // the thread itself: OP_CHECKSEQUENCEVERIFY
require(tx.outputs[i].tokenAmount >= tx.inputs[i].tokenAmount - age * tx.inputs[0].value / 100000000);
require(tx.outputs[i].tokenCategory == tx.inputs[i].tokenCategory);
require(tx.outputs[i].lockingBytecode == tx.inputs[i].lockingBytecode);
require(i == 1);                                         // one thread per claim
```

Transaction layouts:

| Transaction | Inputs | Outputs |
| --- | --- | --- |
| Fund a thread (XO `fundThread`) | the funder's coins | `vaultThreadOutput` (tokens + about 800 sats) at the vault, plus change |
| Claim (XO `claim`) | **input 0:** the claimant's coin (`claimantCoinInput`, sequence = age); **input 1:** the thread (`vaultInput`, sequence = age, unlocking `<age>`); more inputs may follow | **output 0:** `rewardOutput`, the reward to the claimant's address (800 sats); **output 1:** `vaultReturnOutput`, the thread with the reward taken out; change may follow |

### Why the contract is used unchanged

Changing a byte would move the vault to a new address, away from the live BPTS and tBPTS threads. Two choices our house rules would usually flag are deliberate:

- **Fixed positions (input 0, input 1).** The reward is computed from input 0's value, and a fixed input 1 stops one transaction from draining several threads with one coin's age. `this.activeInputIndex` is used for the thread's own output, so the layout is still explicit.
- **Hard-coded 65535 and 100,000,000.** 65535 is the largest block-based relative timelock BIP68 can express, and 10⁸ satoshis is 1 BCH: these are the definition of the reward, not network policy that may change.

### Mapping into the template

| Contract | Template |
| --- | --- |
| The vault script (no constructor parameters) | `scripts.vaultBytecode`: upstream's script text, verbatim |
| Vault address | `lockingScripts.vaultLockingScript`, `lockingType: "p2sh"` (P2SH32) |
| `release(int age)` | action `claim` → `claimTransaction` → `vaultInput` with `unlockRelease: <age>` |
| The claimant's coin at input 0 | `claimantCoinInput`, `inputIndex: 0`, `sequenceNumber: $(<age>)`; the wallet signs it with its own template |
| The reward | `rewardOutput`, locked to `$(<rewardLockingScript>)` (the claimant's address, as in XO's own faucet template), `outputIndex: 0` |
| The thread's return | `vaultReturnOutput`, `outputIndex: 1`, all the thread's satoshis, tokens minus the reward |
| 65535, 10⁸, 800 sats | `constants`, used only in value expressions; a test checks the first two are the numbers in the redeem script |
| Funding | `start` action `fundThread` |

**The reward.** XO output values can't read input values or block heights. So `claim` asks for the claimant coin's value (`claimantCoinSatoshis`), the thread's token amount and satoshis, and the `age` in blocks (the age of the younger of the two coins). `claimReward` is the contract's own `age × value / 10⁸`, floor division, and the claim always takes it in full. Wrong values can't take more than allowed: the vault rejects the claim, or the network rejects a timelock that isn't met.

**Guards.** `checkClaim` makes the engine refuse to build a claim with an age outside 1–65535, a reward of zero (a fungible token output can't carry 0 tokens), or a reward the thread can't cover. `checkThreadAmount` refuses an empty thread.

**Timelocks done properly.** The template sets both inputs' sequence numbers to exactly `age`, a block-based relative timelock, so the network itself checks that the claimant's coin and the thread are at least `age` blocks old.

Roles: `funder` deposits threads, and `claimant` claims. Threads have zero balance and `selectable: false`, so a wallet never counts them as its own funds or spends them for anything else.

## Safety notes

- **Funding a thread is irreversible.** Anyone with an aged coin can claim the tokens, and the funder has no way to take them back.
- **Rewards are small by design:** 1 BCH held for 144 blocks (a day) earns 144 base units. A claim needs `age × value ≥ 10⁸` to earn anything; the template refuses claims that would earn 0.
- **Moving the claimant's coin resets its age.** The claim itself spends it (it returns as change), so its age starts again from the claim's block.
- **One claim per thread per block.** Two claims on the same thread race and the first wins; there are many threads, so claimants rarely collide.

## Findings to share upstream

- **Coin age can be skipped.** The vault checks only `tx.inputs[0].sequenceNumber >= age`. A sequence number with the BIP68 disable bit set (for example `0xffffffff`) passes that check but switches off the relative timelock, so the network never checks the claimant coin's age. The thread's own `OP_CHECKSEQUENCEVERIFY` still limits `age` to the thread's age, so the release rate per thread is unchanged, but a freshly moved coin can claim as if it were aged. Checking `tx.inputs[0].sequenceNumber == age`, or that the disable and type bits are clear, would close this. `test/contract.test.ts` shows the contract accepts it. Our template always sets the sequence number to exactly `age`.
- **Thread satoshis aren't protected.** The vault doesn't check the returned thread's value, so a claimant can take a thread's satoshis down to the token dust limit (about 146 of its 800). Tested; our template returns them all.
- **Older addresses in the repo.** `contracts/unspent/blockpoint.v3.cash` (and its artifact) and `packages/blockpoint/src/test/address.test.ts` describe older versions, not the v3.2 vault the app uses.

## XO engine notes (engine 0.1.1-next.18029697917)

- **`lockingScript: "$(<rewardLockingScript>)"`** on an output works, as in XO's own faucet template: the claimant names any address for the reward.
- **Sequence numbers from variables** (`sequenceNumber: "$(<age>)"`) resolve through the engine's own `completeMergedInput` (tested).
- **Tracking, again.** As with Token Burner and Drip Mine, the engine only unlocks threads it already tracks. A wallet starts watching the vault when it funds a thread or claims. A fresh wallet's first claim needs either a `fundThread` first, or the thread's unlocking (`<age>` plus the redeem-script push) supplied by a `mergesWith` commit, as shown in drip-mine/README.md.
- **Abandoned invitations keep their coins reserved.** When an Electrum connection drops between `createInvitation` and broadcast, the coins stay reserved (`UnspentOutputReservationExternalConflictError` on the next run). `engine.archiveInvitation` clears the reservations; `scripts/chipnet.ts release <invitation>` does this.

## Tests

```bash
cd templates && npm test
```

- `test/contract.test.ts` (14 tests, Libauth VM with real token data).
  - Accepts the full allowance (1 BCH × 144 blocks = 144 tokens), a smaller claim, the 65535-block maximum, and extra inputs and outputs after the thread.
  - Rejects a reward one token too large, an age above 65535, a claimant coin or a thread whose sequence number is below the age, the thread anywhere but input 1, the thread returned to another address or holding another category, and a version 1 transaction. Each rejection is asserted to come from the vault itself.
  - Shows the two findings above.
- `test/template.test.ts` (13 tests).
  - The embedded script is upstream's text, compiles to the live redeem script and both addresses, and its constants match.
  - Thread deposits, rewards and thread returns resolve through the engine's own `completeMergedOutput`; claims built from the template pass the VM from 1 to 65535 blocks; the guards refuse bad claims; both inputs get `sequenceNumber = age` from `completeMergedInput`; the layout is fixed as the vault needs.
  - `template.json` is current, the identifier is stable, and the registry audit reports no failures.

## Chipnet

```bash
cd templates
npx tsx block-points/scripts/chipnet.ts fund-thread                # XO action fundThread: 100,000 test tokens into a new thread
npx tsx block-points/scripts/chipnet.ts claim                      # XO action claim, from the oldest tBPTS thread
npx tsx block-points/scripts/chipnet.ts rebroadcast <invitation>   # resend a stored, signed claim
npx tsx block-points/scripts/chipnet.ts release <invitation>       # free the coins of an abandoned invitation
```

| Step | Transaction | What happened |
| --- | --- | --- |
| Fund a thread | `d3d69755f1e7c982534b2a02c30615f0c8e7458e43e9bac06c883d9309628277` | XO action `fundThread`: 100,000 units of our test token (`0b7ed51a…`) with 800 sats into the vault. The wallet then saw all 127 tBPTS threads |
| Claim | not run | Skipped. Needs a coin with `age × value ≥ 10⁸`: the test wallet's largest coin is 2,900 sats, which earns 0 tokens even after 2,068 blocks, and the template refuses that claim |

Runs on 2026-11-18 with template `053e42af…f439`. Everything ran through the XO engine. Mainnet was not touched.
