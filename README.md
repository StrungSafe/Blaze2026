# XOGrid

XOGrid is a marketplace for XO templates: a registry ("Docker Hub for XO templates") where anyone can publish a template, get a content-addressed identifier, see automated audit results, community flags and moderator reviews, and discover templates by what they do.

Built for BCH BLAZE 2026 (Mainnet Track, Community Choice and the Build with XO bounty).

## What is in it

- A registry server (Fastify, SQLite) that stores and serves templates by identifier, runs audit checks, tracks flags and reviews, and previews a wallet trust policy.
- A moderator portal with wallet login (WizardConnect or a signed message).
- A React and Tailwind web app: browse, template detail, admin and a demo.
- A novel template, the claim-code voucher: lock satoshis to the hash of a secret code, and whoever knows the code can claim them. Verified end to end on chipnet.

## Status

The build window opened on Nov 14. The registry, audit and login groundwork was prototyped earlier in the original repository (StrungSafe/Blaze2026, public history) and is being brought into this repository in stages, each as its own pull request. The demo, the voucher flow, the mainnet transaction and the polish are built here.

## Docs

- [Scope](docs/SCOPE.md)
- [Build spec](docs/XO%20SPEC.md)
- [Proposal checklist](docs/PROPOSAL.md)
