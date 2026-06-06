# Cardon

[![Live demo](https://img.shields.io/badge/demo-cardon--protocol.vercel.app-black)](https://cardon-protocol.vercel.app)
architecture design - (https://github.com/Hijanhv/cardon--Architecture-Design-)

An on-chain transaction firewall for Solana AI agents.

Cardon sits between an autonomous agent and the network. Every transaction the agent wants to broadcast gets simulated, checked against a policy stored in an Anchor program, and either signed, queued for a human approver, or rejected. Because the policy and approval rules live on-chain, no single operator can quietly raise a spend cap or remove a kill switch.

This is my Turbin3 Builders cohort capstone. The full project definition, market analysis, and process appendix is in [`docs/CAPSTONE_PROPOSAL.md`](docs/CAPSTONE_PROPOSAL.md).

Live demo: **https://cardon-protocol.vercel.app** (landing page and the HITL approval queue at `/dashboard`).

## Status

| Layer | Status |
|---|---|
| Anchor program (`programs/cardon`) | Compiles and tests pass locally |
| Rust SDK (`sdk/cardon-rs`) | Types, PDA helpers, and the policy-preview function are in. The async on-chain client (`--features client`) with a Helius/RPC simulation hook and a `guard()` firewall path is wired and unit-tested. |
| TypeScript SDK (`packages/cardon-ts`, `@cardon/sdk`) | PDA helpers, client-side policy preview, `txHash`, intent extraction, and a `CardonClient` with a `guard()` firewall path. Typechecks. |
| SendAI adapter (`packages/cardon-agent-kit`, `@cardon/agent-kit`) | `CardonWallet` (enforces policy on every sign/send) + `createCardonPlugin` (LLM-facing actions). Typechecks. Demo in `examples/jupiter-swap-agent`. |
| Squads multisig HITL (`packages/cardon-ts` `squads.ts`) | Helpers to govern a policy with a Squads v4 multisig — the policy authority is the vault PDA, approvals route through a Squads proposal that CPIs `approve_tx`. No program change needed. See [`docs/SQUADS.md`](docs/SQUADS.md). |
| Audit mirror + webhook (`services/audit-mirror`) | Event indexer (decodes `emit!` logs into an append-only store) plus a Helius webhook listener that confirms the broadcast leg. |
| Next.js HITL dashboard (`dashboard/`) | Landing page + pending-approval queue against the on-chain program. Deployed at [cardon-protocol.vercel.app](https://cardon-protocol.vercel.app). |
| Capstone proposal (`docs/`) | Final. The PDF for submission is generated from `docs/CAPSTONE_PROPOSAL.md`. |

## Layout

```
cardon/
├── docs/                       # capstone proposal + sources
├── research/                   # raw scrapes used as primary sources
├── programs/cardon/            # Anchor program (Rust)
├── sdk/cardon-rs/              # Rust SDK + async client (--features client)
├── packages/cardon-ts/         # TypeScript SDK (@cardon/sdk)
├── packages/cardon-agent-kit/  # SendAI Agent Kit adapter (@cardon/agent-kit)
├── examples/jupiter-swap-agent/# Toy agent demoing firewall enforcement
├── services/audit-mirror/      # Event indexer + Helius broadcast webhook
├── dashboard/                  # Next.js HITL approval queue
├── tests/cardon.ts             # Anchor end-to-end test
├── Anchor.toml
└── Cargo.toml                  # workspace
```

## Quick start

Build the program and run the test suite against a local validator:

```bash
anchor build
anchor test
```

Run the dashboard against devnet:

```bash
cd dashboard
npm install
NEXT_PUBLIC_RPC=https://api.devnet.solana.com npm run dev
```

The dashboard expects the Cardon program to be deployed at the program ID in `Anchor.toml` and the IDL to be uploaded on-chain (`anchor idl init`).

## Program shape

Three account types:

- `Agent` — registers an agent's signing key, ties it to a `Policy`, and tracks an `enabled` flag plus a pending-nonce counter.
- `Policy` — per-agent rules: max lamports per tx, the HITL threshold, daily volume ceiling, allowed-program list.
- `PendingTx` — created when a submission is over the HITL threshold; stays around until the authority calls `approve_tx` or `reject_tx`, then closes and refunds rent.

Seven instructions:

- `register_agent`, `set_policy`, `set_enabled` — authority-owned.
- `submit_auto` — fast path; the agent signs and the policy auto-approves. Fails if any cap is hit.
- `submit_for_review` — creates a `PendingTx`. Used when the SDK's local policy preview says the tx is above the HITL threshold.
- `approve_tx`, `reject_tx` — authority decides on a pending tx. Volume counter only advances on approval.

Audit trail is event-based (`emit!`), not account-based — every approval, rejection, and policy change shows up in transaction logs and can be indexed off-chain via Helius.

## Why on-chain policy

The closest existing product, ClawdieLabs' Sentinel, runs the policy registry as centralized middleware. Whoever has code access can change the rules. Cardon's policy is in an Anchor program with an `authority` field that can be a multisig PDA (Squads) or a DAO governance program. Rotating policy authority is an on-chain transaction, not a config push.

The full positioning, market analysis, and adversarial critique is in [`docs/CAPSTONE_PROPOSAL.md`](docs/CAPSTONE_PROPOSAL.md).
