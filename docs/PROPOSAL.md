# Proposal: BCH Music Streaming (name TBD)

**Status: DRAFT. Nothing here is agreed. Please comment on the PR.**

## Concept

A music streaming platform on Bitcoin Cash. Listeners pay a monthly BCH
subscription for a time-limited access pass. Artists earn BCH through an
on-chain revenue split. There is a free tier so judges and new users get value
in the first 30 seconds or we can do am ads plagued free tier.

## Plans

| Plan              | What you get                                                                                                    | How it works                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Free              | Whole catalog with limited access (e.g. 30-second previews or N full plays per day and listen to ads for more) | No wallet needed                         |
| Premium (monthly) | Unlimited full listening for 30 days+access to podcasts                                                         | Pay BCH, receive a pass NFT that expires |

## Access pass (CashTokens NFT)

- Minted when the subscription payment confirms.
- The NFT commitment encodes the expiry timestamp.
- The backend checks on-chain that the wallet holds a valid pass before serving audio.
- Renewal extends the expiry.
- **Open question (partner):** minting design. A minting-token held by a covenant, or a backend-signed mint?

## Revenue model (DECISION NEEDED)

**Option A: listener picks artists at subscribe time.** Each payment is split in one
transaction: platform fee plus the artists the listener chose. Fully on-chain and
trustless, but no pool, so it is less "Spotify-like".

**Option B: pro-rata pool.** Payments go to a pool. Monthly, a payout transaction splits
it by each artist's share of total streams. Stream counts come from the backend, so
this has a trust assumption. Mitigation: publish the monthly stream report and
payout transaction IDs so anyone can audit. The payout covenant enforces that money
only goes to the registered artists at the published percentages.

Recommendation to discuss: A is more simpler (simplest working demo), B will eat up time so we can add that if time allows.

## Contracts

- `contracts/RevenueSplit.cash`: fixed-percentage split covenant (draft, compiles).
- Subscription/pass minter: TBD
- Test on chipnet first, then mainnet. The hackathon requires a real mainnet BCH transaction.

## Stack (proposed)

- Contracts: CashScript
- Frontend: Next.js + CashScript/mainnet-js SDK + WizardConnect (required by the rules)
- Backend: FastAPI (catalog, pass verification, gated audio, earnings/stream reports)
- Audio: static files on cheap object storage; 6-10 royalty-free or original tracks

## Open questions

1. Option A or B for the split?
2. Free tier limit: previews or daily plays?
3. Pass minting design?
4. Project name, plus a CashTokens address for EMBER2026.

## Eligibility checklist

- [ ] Roll call attended by at least one member
- [ ] Project confirmed in the BCH BLAZE Telegram channel
- [ ] Registered on DoraHacks (closes Nov 13)
- [ ] WizardConnect or XO Template wallet integration
- [ ] Live mainnet demo that sends BCH
- [ ] Home page banner: Widget Factory slides, GitHub link, EMBER2026 address
