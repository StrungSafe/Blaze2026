# Contracts → XO templates

Each folder here is one **contract system**: BCH contracts converted into an XO template, with tests that show the template builds exactly the contract. Folders whose names start with `_` are not systems.

The method follows the guide [Building a BCH XO Template for a Smart Contract](https://claude.ai/artifact/7iB9WGK2fp25LUU5BbDzm3).

## Systems

| System | Status | Template identifier | Based on | Credits |
| --- | --- | --- | --- | --- |
| [revenue-split](revenue-split/) | Chipnet verified (fund + payout); 22 offline tests | `9674cee2464188e897ec8a48c132edfe34e8f0183b8e9e437194a4997c974b2e` | Draft [`RevenueSplit.cash`](https://github.com/XOGrid-Cash/Blaze2026_XOGrid/blob/8267aec7042fac07662ec5b2e765643d834fa127/contracts/RevenueSplit.cash) (XOGrid commit `8267aec`) | angelnath |

**Status levels**: Draft → Tested offline → Chipnet verified → Reviewed. Update the row in the same change that moves a system forward.

## Layout of a system

```
<system>/
  README.md          what it does, design and transaction layout, Credits, changes from the original, status, ids, txids
  *.cash             the CashScript contract(s)
  artifact/*.json    cashc artifacts, committed so reviewers can diff the exact bytecode
  template.ts        the XO template as a plain object; reads its bytecode from the artifact
  template.json      canonical serializeTemplate(parseTemplate(...)) output: the bytes a registry publishes (generated)
  test/              contract tests (CashScript SDK) and template tests (equivalence, VM spends, audit)
  scripts/           end-to-end runs on chipnet with the XO engine
```

Start a new system by copying [`_skeleton/`](_skeleton/).

## Workflow

```bash
npm install                          # once
npm run compile                      # .cash -> artifact/*.json, prints bytecode size and opcount
npm run template:json                # template.ts -> template.json, prints the identifier
npm test                             # every system's tests
npm run typecheck
```

A system's tests must prove, at minimum:

1. **Equivalence**: the template's compiled locking bytecode equals the CashScript contract's locking bytecode for the same arguments. This catches argument-order and bytecode-copy mistakes.
2. **Spends**: every contract function has transactions the VM accepts, and transactions it rejects (wrong amount, recipient, order, missing output).
3. **Audit**: XOGrid's automated audit (`server/src/audit`) reports no failures.

Then prove it on chipnet with the system's script, record the txids in its README, and open the saved invitations in the Blaze Tool (blaze.xo.cash, set to chipnet, import `template.json` first).

## Attribution

Many systems build on other people's open-source work. Credit them every time, in three places:

- **The system README** has a Credits section: the original author, a link to the exact source (repository, commit, file), its licence, and a list of what we changed and why.
- **The template** lists the same source in `resources`, so wallets and the registry show it to users.
- **The table above** names the source and the author.

Before adapting third-party code, check that its licence allows it, and keep any licence notice it requires next to the copied code. If the author or licence can't be determined, say so in the README instead of leaving it out.

## Notes

- Tooling versions are pinned to match `server/` (XO engine, utils, templates and Libauth) and to cashc and CashScript 0.14.0.
- npm only runs install scripts that `allowScripts` in `package.json` lists. `sqlite3` is allowed because the XO engine's state package loads it.
- The tests import the registry audit from `../server/src/audit`. `vitest.config.ts` resolves its packages from this workspace, so `server/` needs no install of its own.
