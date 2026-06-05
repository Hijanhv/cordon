# @cardon/agent-kit

[Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) adapter for the [Cardon](../../README.md) firewall. Drop it into any SendAI-based agent so every transaction the agent signs or sends is first checked against the on-chain policy — auto-approved, queued for a human, or rejected.

## Install

```bash
npm install @cardon/agent-kit @cardon/sdk
```

`solana-agent-kit` is an optional peer dependency (the host agent provides it).

## Two integration points

### 1. `CardonWallet` — enforcement

Wrap the agent's wallet. This is where policy is actually enforced:

```ts
import { CardonClient } from "@cardon/sdk";
import { CardonWallet, CardonReviewRequiredError } from "@cardon/agent-kit";
import { SolanaAgentKit } from "solana-agent-kit";

const client = CardonClient.fromConnection(connection, new Wallet(feePayer));
const wallet = new CardonWallet({ inner, client, agent: agentPda, agentSigner });

const agentKit = new SolanaAgentKit(wallet, RPC_URL, {});
// ...agent runs as normal. A high-value tx now throws CardonReviewRequiredError
// instead of broadcasting, and shows up in the HITL dashboard.
```

`signTransaction`, `signAllTransactions`, `signAndSendTransaction`, and `sendTransaction` all run the firewall first. Outcomes surface as `CardonPolicyDeniedError`, `CardonSimulationError`, or `CardonReviewRequiredError`.

### 2. `createCardonPlugin` — LLM-facing actions

Register the plugin so the agent's model can inspect its own guardrails:

```ts
import { createCardonPlugin } from "@cardon/agent-kit";

agentKit.use(createCardonPlugin({ client, agent: agentPda }));
// adds CARDON_GET_POLICY and CARDON_LIST_PENDING actions + agent.methods.{getPolicy,listPending,guard}
```

See [`examples/jupiter-swap-agent`](../../examples/jupiter-swap-agent) for a runnable demo.
