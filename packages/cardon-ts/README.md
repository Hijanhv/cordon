# @cardon/sdk

TypeScript binding for the [Cardon](../../README.md) on-chain transaction firewall. Mirrors the Rust SDK (`cardon-rs`): PDA helpers, a pure client-side `preview()` of the on-chain policy, a SHA-256 `txHash` helper, transaction intent extraction, and a `CardonClient` over the Anchor program with a `guard()` firewall path.

## Install

```bash
npm install @cardon/sdk
```

## Usage

```ts
import { Connection } from "@solana/web3.js";
import { Wallet } from "@coral-xyz/anchor";
import BN from "bn.js";
import { CardonClient } from "@cardon/sdk";

const client = CardonClient.fromConnection(
  new Connection("https://api.devnet.solana.com"),
  new Wallet(feePayer)
);

// Run a candidate tx through the firewall: preview → simulate → submit/queue.
const result = await client.guard(agentSigner, agentPda, {
  lamports: new BN(500_000_000),
  targetProgram: jupiterProgramId,
  instructions: swapInstructions, // simulated before submission
});

switch (result.kind) {
  case "auto_approved": /* under threshold, recorded on-chain */ break;
  case "queued":        /* over threshold, awaiting human approval */ break;
  case "denied":        /* policy rejected: result.denial */ break;
  case "simulation_failed": /* would fail on-chain: result.logs */ break;
}
```

## What's exported

- `CARDON_PROGRAM_ID`, `findAgentPda`, `findPolicyPda`, `findPendingPda`
- `preview`, `PolicyOutcome`, `PolicyDenial` — the client-side policy mirror
- `extractIntent` — best-effort lamports + program extraction from a tx
- `txHash` — the on-chain audit reference hash
- `CardonClient` — full async client (fetch, instruction builders, `simulate`, `guard`)
