# @cordon/agent-kit

[Solana Agent Kit](https://github.com/sendaifun/solana-agent-kit) adapter for the [Cordon](../../README.md) firewall. Drop it into any SendAI-based agent so every transaction the agent signs or sends is first checked against the on-chain policy — auto-approved, queued for a human, or rejected.

## Install

```bash
npm install @cordon/agent-kit @cordon/sdk
```

`solana-agent-kit` is an optional peer dependency (the host agent provides it).

## Two integration points

### 1. `CordonWallet` — enforcement

Wrap the agent's wallet. This is where policy is actually enforced:

```ts
import { CordonClient } from "@cordon/sdk";
import { CordonWallet, CordonReviewRequiredError } from "@cordon/agent-kit";
import { SolanaAgentKit } from "solana-agent-kit";

const client = CordonClient.fromConnection(connection, new Wallet(feePayer));
const wallet = new CordonWallet({ inner, client, agent: agentPda, agentSigner });

const agentKit = new SolanaAgentKit(wallet, RPC_URL, {});
// ...agent runs as normal. A high-value tx now throws CordonReviewRequiredError
// instead of broadcasting, and shows up in the HITL dashboard.
```

`signTransaction`, `signAllTransactions`, `signAndSendTransaction`, and `sendTransaction` all run the firewall first. Outcomes surface as `CordonPolicyDeniedError`, `CordonSimulationError`, or `CordonReviewRequiredError`.

### 2. `createCordonPlugin` — LLM-facing actions

Register the plugin so the agent's model can inspect its own guardrails:

```ts
import { createCordonPlugin } from "@cordon/agent-kit";

agentKit.use(createCordonPlugin({ client, agent: agentPda }));
// adds CORDON_GET_POLICY and CORDON_LIST_PENDING actions + agent.methods.{getPolicy,listPending,guard}
```

See [`examples/jupiter-swap-agent`](../../examples/jupiter-swap-agent) for a runnable demo.
