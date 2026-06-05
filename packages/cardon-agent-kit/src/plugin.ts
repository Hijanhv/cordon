import { PublicKey } from "@solana/web3.js";
import { z } from "zod";
import { CardonClient } from "@cardon/sdk";

import type { Action, Plugin, SolanaAgentKit } from "./sak-types";

export interface CardonPluginConfig {
  client: CardonClient;
  /** The agent PDA registered on the Cardon program. */
  agent: PublicKey;
}

/**
 * A Solana Agent Kit plugin that exposes the Cardon firewall to the agent's
 * LLM as callable actions, and surfaces the policy/queue helpers on
 * `agent.methods`. Pair it with {@link CardonWallet} for actual enforcement.
 *
 * ```ts
 * agentKit.use(createCardonPlugin({ client, agent }));
 * ```
 */
export function createCardonPlugin(config: CardonPluginConfig): Plugin {
  const getPolicy: Action = {
    name: "CARDON_GET_POLICY",
    similes: [
      "show firewall policy",
      "get cardon policy",
      "what are my spend limits",
      "show spend caps",
    ],
    description:
      "Fetch the on-chain Cardon policy (per-tx cap, HITL threshold, daily volume ceiling, program allowlist) for this agent.",
    examples: [
      [
        {
          input: {},
          output: { maxLamportsPerTx: "1000000000" },
          explanation: "Returns the agent's current on-chain policy.",
        },
      ],
    ],
    schema: z.object({}),
    handler: async () => {
      const policy = await config.client.fetchPolicy(config.agent);
      return {
        maxLamportsPerTx: policy.maxLamportsPerTx.toString(),
        hitlThresholdLamports: policy.hitlThresholdLamports.toString(),
        dailyVolumeCeiling: policy.dailyVolumeCeiling.toString(),
        volumeToday: policy.volumeToday.toString(),
        allowedPrograms: policy.allowedPrograms.map((p) => p.toBase58()),
      };
    },
  };

  const listPending: Action = {
    name: "CARDON_LIST_PENDING",
    similes: [
      "list pending approvals",
      "what is awaiting review",
      "cardon queue",
      "show pending transactions",
    ],
    description:
      "List transactions the Cardon firewall has queued for human approval for this agent.",
    examples: [
      [
        {
          input: {},
          output: { pending: [] },
          explanation: "Returns the transactions awaiting human approval.",
        },
      ],
    ],
    schema: z.object({}),
    handler: async () => {
      const pending = await config.client.pendingForAgent(config.agent);
      return {
        pending: pending.map((p) => ({
          pubkey: p.publicKey.toBase58(),
          lamports: p.lamports.toString(),
          targetProgram: p.targetProgram.toBase58(),
          nonce: p.nonce.toString(),
          proposedAt: p.proposedAt.toString(),
        })),
      };
    },
  };

  const methods = {
    getPolicy: () => config.client.fetchPolicy(config.agent),
    listPending: () => config.client.pendingForAgent(config.agent),
    guard: config.client.guard.bind(config.client),
  };

  return {
    name: "cardon",
    methods,
    actions: [getPolicy, listPending],
    initialize(agent: SolanaAgentKit) {
      agent.methods = { ...agent.methods, ...methods };
    },
  };
}
