# Squads multisig HITL approvals

Cardon's policy `authority` is an ordinary pubkey enforced with a `has_one = authority` constraint. That means a [Squads v4](https://squads.so) multisig can govern an agent's policy and approve its queued transactions **without any change to the on-chain program** — the multisig's vault PDA simply *is* the authority.

This turns the human-in-the-loop approver from a single signer into an *m-of-n* multisig (or a DAO), so no single operator can unilaterally approve a high-value transaction or quietly loosen a policy. It's the institutional-grade HITL path from the build plan.

Helpers live in `@cardon/sdk` (`src/squads.ts`).

## 1. Register the agent under multisig control

Set the policy authority to the Squads vault PDA:

```ts
import { CardonClient, cardonPolicyAuthority } from "@cardon/sdk";

const multisig = { multisigPda, vaultIndex: 0 };
const authority = cardonPolicyAuthority(multisig); // the Squads vault PDA

await client.registerAgent({
  authority,           // <-- multisig vault, not a single signer
  agentSigner,
  agent: agentPda,
  maxLamportsPerTx,
  hitlThresholdLamports,
  dailyVolumeCeiling,
  allowedPrograms,
});
```

## 2. The agent queues a high-value tx

Nothing special — when a tx is over the HITL threshold, `guard()` (or `CardonWallet`) calls `submit_for_review` and a `PendingTx` is created, exactly as with a single-signer authority.

## 3. Propose the approval through Squads

Build the Cardon `approve_tx` instruction (authority = the vault PDA), wrap it in a Squads vault transaction + proposal, and send both:

```ts
import {
  proposeCardonInstruction,
  approveCardonProposal,
  executeCardonProposal,
} from "@cardon/sdk";

const transactionIndex = /* multisig.transactionIndex + 1n */;

const approveIx = await client.approveTxInstruction(
  authority,        // vault PDA signs via CPI on execution
  agentPda,
  pendingPda,
  rentReceiver
);

const { vaultTransactionCreateIx, proposalCreateIx } = proposeCardonInstruction({
  multisig,
  transactionIndex,
  creator,          // a multisig member
  instruction: approveIx,
});
// send [vaultTransactionCreateIx, proposalCreateIx] in one transaction
```

## 4. Members approve, then execute

```ts
// each member, until the threshold is met:
const voteIx = approveCardonProposal({ multisig, transactionIndex, member });

// once threshold is reached, any member executes:
const { instruction: executeIx } = await executeCardonProposal({
  connection,
  multisig,
  transactionIndex,
  member,
});
// Squads CPIs Cardon's approve_tx, signing as the vault PDA. The PendingTx
// closes, the volume counter advances, and TxHumanApproved is emitted.
```

`reject_tx` and `set_policy` follow the same pattern — use `client.rejectTxInstruction(...)` or `client.setPolicyInstruction(...)` as the wrapped instruction. Both take the vault PDA as `authority`.

## Trying it on a validator

The flow above is exercised against any cluster where the Squads v4 program is present (mainnet/devnet have it deployed). For a local validator, dump the program first:

```bash
solana program dump SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf squads_v4.so
solana-test-validator --bpf-program SQDS4ep65T869zMMBKyuUq6aD6EgTu8psMjkvj52pCf squads_v4.so
```

Then create a multisig with `@sqds/multisig`, register a Cardon agent with `cardonPolicyAuthority(multisig)` as the authority, and run steps 2–4.
