# <System name>

<!-- Copy this folder to templates/<system-name>/ (lowercase, hyphenated) and replace every <placeholder>. -->

<One or two sentences: what the contract does, for a user who has never seen it.>

| | |
| --- | --- |
| Status | Draft |
| Contract | [`<Contract>.cash`](<Contract>.cash), cashc <version>, <bytes> bytes, <opcodes> opcodes (`npm run compile`) |
| Template | [`template.ts`](template.ts) → [`template.json`](template.json) |
| Template identifier | `<npm run template:json>` |
| Chipnet | fund: `<txid>` · <action>: `<txid>` |

## Credits

<!-- Required. Name the people whose work this builds on and link the exact source. -->

- **Original work:** [`<file or repo>`](<url to the exact commit or tag>) by **<author>** (<licence>).
- **Adapted by:** <who>, in this folder. The changes are listed below.

If the author or licence can't be determined, say so here.

## Design

<Each contract's single responsibility, and how contracts authenticate each other.>

Transaction layout, relative to the contract's input index `i`:

| Position | Holds | Constrained by |
| --- | --- | --- |
| input `i` | | |
| output `i` | | |

### Mapping into the template

| Contract | Template |
| --- | --- |
| Constructor parameters | |
| Compiled bytecode | |
| Redeem script | `<argN> … <arg1> <contract>Bytecode` |
| Each function | action / transaction / input with its unlocking script |

## Changes from the original

| Change | Why |
| --- | --- |
| | |

## Safety notes

<Parameter values that lock coins forever, dust, tokens, front-running, scale.>

## Tests

<What each test file proves. Minimum: equivalence with CashScript, VM spends that pass and fail, audit with no failures.>

## Chipnet

<How to run scripts/chipnet.ts, and where the txids and invitations are recorded.>
