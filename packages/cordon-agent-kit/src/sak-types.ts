/**
 * Minimal local mirrors of the Solana Agent Kit (`solana-agent-kit`) public
 * contracts, so this adapter typechecks without pulling the full ~100MB kit.
 *
 * These are structurally compatible with the upstream interfaces in
 * `@solana-agent-kit/core` (`packages/core/src/types`). At runtime, `solana-agent-kit`
 * is a peer dependency — install it in the host agent project.
 */
import type {
  PublicKey,
  SendOptions,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import type { z } from "zod";

export interface BaseWallet {
  readonly publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>;
  sendTransaction?: <T extends Transaction | VersionedTransaction>(
    transaction: T
  ) => Promise<string>;
  signAndSendTransaction: <T extends Transaction | VersionedTransaction>(
    transaction: T,
    options?: SendOptions
  ) => Promise<{ signature: TransactionSignature }>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
}

export interface ActionExample {
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  explanation: string;
}

export type Handler = (
  agent: SolanaAgentKit,
  input: Record<string, unknown>
) => Promise<Record<string, unknown>>;

export interface Action {
  name: string;
  similes: string[];
  description: string;
  examples: ActionExample[][];
  schema: z.ZodType<unknown>;
  handler: Handler;
}

export interface Plugin {
  name: string;
  methods: Record<string, unknown>;
  actions: Action[];
  initialize(agent: SolanaAgentKit): void;
}

/** The fields of `SolanaAgentKit` this adapter touches. */
export interface SolanaAgentKit {
  wallet: BaseWallet;
  connection: import("@solana/web3.js").Connection;
  methods: Record<string, unknown>;
  [key: string]: unknown;
}
