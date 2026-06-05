import {
  PublicKey,
  SendOptions,
  Signer,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { CordonClient, extractIntent, PolicyDenial } from "@cordon/sdk";

import type { BaseWallet } from "./sak-types";

/** Thrown when the firewall queued the tx for human approval; the agent must not broadcast it. */
export class CordonReviewRequiredError extends Error {
  constructor(
    readonly pending: PublicKey,
    readonly nonce: BN,
    readonly signature: string
  ) {
    super(
      `Cordon queued this transaction for human review (pending=${pending.toBase58()})`
    );
    this.name = "CordonReviewRequiredError";
  }
}

/** Thrown when the on-chain policy rejects the tx outright. */
export class CordonPolicyDeniedError extends Error {
  constructor(readonly denial: PolicyDenial) {
    super(`Cordon policy denied the transaction: ${denial}`);
    this.name = "CordonPolicyDeniedError";
  }
}

/** Thrown when RPC/Helius simulation says the tx would fail on-chain. */
export class CordonSimulationError extends Error {
  constructor(
    readonly logs: string[],
    readonly errString: string
  ) {
    super(`Cordon simulation failed: ${errString}`);
    this.name = "CordonSimulationError";
  }
}

export interface ResolvedIntent {
  lamports: BN;
  targetProgram: PublicKey;
}

export interface CordonWalletConfig {
  /** The agent's real wallet that ultimately signs/sends. */
  inner: BaseWallet;
  /** Client for the Cordon program (with its own funded fee payer). */
  client: CordonClient;
  /** The agent PDA registered on the Cordon program. */
  agent: PublicKey;
  /** The registered agent signing key (signs the Cordon submit instructions). */
  agentSigner: Signer;
  /**
   * Override how lamports + target program are derived from a transaction.
   * Recommended for versioned transactions, where on-chain value can't be
   * reliably decoded off-chain.
   */
  resolveIntent?: (
    tx: Transaction | VersionedTransaction
  ) => ResolvedIntent | null;
  /** Called when a tx is queued for review, just before the error is thrown. */
  onReview?: (error: CordonReviewRequiredError) => void;
}

/**
 * A `BaseWallet` wrapper that runs every transaction through the Cordon
 * firewall before the inner wallet signs or sends it. This is the drop-in
 * integration point for a Solana Agent Kit agent:
 *
 * ```ts
 * const wallet = new CordonWallet({ inner, client, agent, agentSigner });
 * const agentKit = new SolanaAgentKit(wallet, RPC, {});
 * ```
 */
export class CordonWallet implements BaseWallet {
  constructor(private readonly cfg: CordonWalletConfig) {}

  get publicKey(): PublicKey {
    return this.cfg.inner.publicKey;
  }

  private resolve(tx: Transaction | VersionedTransaction): ResolvedIntent {
    const override = this.cfg.resolveIntent?.(tx);
    if (override) return override;

    const intent = extractIntent(tx);
    if (!intent.targetProgram) {
      throw new Error(
        "Cordon: could not determine the target program from the transaction; supply resolveIntent()"
      );
    }
    return { lamports: intent.lamports, targetProgram: intent.targetProgram };
  }

  /** Run the firewall check; resolves on auto-approve, throws otherwise. */
  private async enforce(
    tx: Transaction | VersionedTransaction
  ): Promise<void> {
    const { lamports, targetProgram } = this.resolve(tx);
    const instructions = tx instanceof Transaction ? tx.instructions : undefined;

    const result = await this.cfg.client.guard(
      this.cfg.agentSigner,
      this.cfg.agent,
      { lamports, targetProgram, instructions }
    );

    switch (result.kind) {
      case "auto_approved":
        return;
      case "denied":
        throw new CordonPolicyDeniedError(result.denial);
      case "simulation_failed":
        throw new CordonSimulationError(result.logs, result.err);
      case "queued": {
        const error = new CordonReviewRequiredError(
          result.pending,
          result.nonce,
          result.signature
        );
        this.cfg.onReview?.(error);
        throw error;
      }
    }
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T> {
    await this.enforce(transaction);
    return this.cfg.inner.signTransaction(transaction);
  }

  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    for (const tx of transactions) {
      await this.enforce(tx);
    }
    return this.cfg.inner.signAllTransactions(transactions);
  }

  signAndSendTransaction = async <T extends Transaction | VersionedTransaction>(
    transaction: T,
    options?: SendOptions
  ): Promise<{ signature: TransactionSignature }> => {
    await this.enforce(transaction);
    return this.cfg.inner.signAndSendTransaction(transaction, options);
  };

  sendTransaction = async <T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<string> => {
    if (!this.cfg.inner.sendTransaction) {
      throw new Error("Cordon: inner wallet does not implement sendTransaction");
    }
    await this.enforce(transaction);
    return this.cfg.inner.sendTransaction(transaction);
  };

  signMessage(message: Uint8Array): Promise<Uint8Array> {
    return this.cfg.inner.signMessage(message);
  }
}
