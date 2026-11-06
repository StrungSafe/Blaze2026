# Scope proposal: XO Template Hub (registry + audit + test runner)

Status: PROPOSAL - Nothing here is decided. Belongs on a proposal branch, not main.

## One-line pitch

A "Docker Hub for XO templates": publish a template, get a content-addressed ID (`templateIdentifier`), see automated audit results and community flags, and check it against a wallet-style trust policy before using it. The XO team (kiok.bch, Nov 3) confirmed this is the direction they want, including audited flags, reputation, fetch-by-identifier and per-wallet security policy. They also said they have not built it yet.

## What we verified (offline, this week)

- Template validation and ID hashing work offline (`@xo-cash/utils`).
- Locking scripts that take only variables compile offline (`@xo-cash/engine`, faucet template OK).
- Key-based locking scripts need key data that the offline compile function does not take through its variables argument. Needs a workaround or a call to the engine's build path.
- The only shipped scenario (P2PKH) cannot be replayed from its role data alone: the expected tx contains a change output the roles do not list.
- XO's own templates repo has no tests, and only P2PKH has a scenario.

## Tiers

### Must (demo and bounty need these)

1. **Registry**: publish, list, fetch by `templateIdentifier`. Seeded with the 4 XO sample templates plus our own.
2. **Our own novel template** (the Build with XO bounty requires one) and one invitation executed on chipnet and then mainnet, inspectable in the Blaze Tool.
3. **Automated audit report v1** per template: schema validation, ID recomputation, offline compile of every locking script that can be compiled, dangling reference checks (roles, actions, scripts, variables), scenario presence. Output is pass/warn/fail per check, versioned by checker version.
4. **Hosted clickable demo** with a mainnet BCH tx, top-of-page banner (slides link, repo link, EMBER2026 CashTokens address), WizardConnect or XO integration.

### Should (the audit and reputation nice-to-haves)

5. **Audit badges**: levels such as Unchecked / Auto-checked / Reviewed. "Reviewed" means a named human reviewer signed off on that exact identifier. Auto-checked never implies safe.
6. **Community flags**: any publisher can flag an identifier with a reason. Flags are shown prominently, never silently hidden.
7. **Publisher reputation**: DEFERRED. Cut from the first release (judges give about two minutes per project). Revisit only if everything else is done. If built: counts of published templates, flags received, reviews given, no objective-looking score.
8. **Wallet policy preview**: a small JSON policy such as "only allow templates at Reviewed or better, block flagged, allow list of identifiers", plus a screen that shows allow or block for any template.
9. **Scenario runner v1**: compile and assert the locking bytecode for key-free scripts, and golden-hex checks where the scenario is self-contained.

### Stretch (only if Should lands early)

10. Full scenario replay through the engine's merged-commit build path (unproven).
11. CashScript-to-XO template generator (revenue split as the showcase).
12. Static covenant-pattern hints (persist, token category preserved, value conserved), flagged as heuristics.

## Two-minute demo path (design target)

Judges give "a couple of minutes" per project and punish confusion. The home page must get a stranger through this without instructions:

1. Banner at top: slides link, repo link, EMBER2026 address.
2. Home shows a short list of templates, each with its badge and any flags.
3. Click one: audit report with plain pass/warn/fail checks.
4. Policy preview shows allow or block for that template.
5. One button runs the invitation and sends a real mainnet BCH tx. Show the txid with a block explorer link.
   Anything that does not serve this path is secondary. Rough edges lose credibility.

## Honesty rules for the product

- XO's blog says scenarios "are not suitable for providing trust". Our badges must say what was checked, not that a template is safe.
- No audit claim without a named reviewer and the exact identifier.
- A changed template has a new identifier, so it starts at Unchecked.

## Proposed split (to discuss)

## Timeline

- Nov 5: go/no-go gate. Engine invitation opens in the Blaze Tool on chipnet, template round-trip validation works, a path to a mainnet tx from a hosted page exists.
- Nov 13: registration closes. Roll call and Telegram confirmation done.
- Nov 14 to 22: submission window (closes 15:00 UTC+1 on Nov 22). Build is already allowed before Nov 14.
- Target: Must done by ~Nov 12, Should by ~Nov 18, polish and writeup after that.

## Tracks and bounties targeted

- Mainnet Track (1st $3,500 PUSD plus BLISS tickets, 2nd $1,500, 3rd $750): scored by 3 judges on innovation, design and usability, technical strength, business potential.
- Community Choice ($750 PUSD): automatic for eligible Mainnet projects that list an EMBER2026-capable CashTokens address.
- Build with XO (0.3 BCH, up to 10 winners): novel template, executed invitation inspectable in the debug tool, follow-up actions, ~500-word feedback written personally by us.
- NOT targeted: Migrate to XO (1 BCH). The XO team said the hub does not qualify (new project, no original to migrate). Identity and stablecoin bounties are out of scope.

## Eligibility checklist (Mainnet Track)

- [ ] Feature that sends a BCH mainnet tx
- [ ] Live clickable demo link
- [ ] Top-of-page banner (slides, repo, EMBER2026 address)
- [ ] WizardConnect or XO Template integration
- [ ] One teammate attended a prep stream (roll call). Workshops on Oct 24 and Oct 31 are past, so check the schedule for later streams
- [ ] Project confirmed real in the BLAZE Telegram channel
- [ ] Registered on DoraHacks before Nov 13

## Questions for Miguel

1. Is the stack choice (one TypeScript app) fine?
2. Which novel template should we write: revenue split, subscription pass, or something he has already built on?
3. Did he or you attend a prep stream for roll call, and is Telegram confirmation done?
4. Has he used the XO engine in a browser, or should we run it on a small server?
5. Who owns the mainnet demo transaction and the banner and slides?
