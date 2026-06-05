import {
  PublicKey,
  SendOptions,
  Signer,
  Transaction,
  TransactionSignature,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";
import { CardonClient, extractIntent, PolicyDenial } from "@cardon/sdk";

import type { BaseWallet } from "./sak-types";

/** Thrown when the firewall queued the tx for human approval; the agent must not broadcast it. */
export class CardonReviewRequiredError extends Error {
  constructor(
    readonly pending: PublicKey,
    readonly nonce: BN,
    readonly signature: string
  ) {
    super(
      `Cardon queued this transaction for human review (pending=${pending.toBase58()})`
    );
    this.name = "CardonReviewRequiredError";
  }
}

/** Thrown when the on-chain policy rejects the tx outright. */
export class CardonPolicyDeniedError extends Error {
  constructor(readonly denial: PolicyDenial) {
    super(`Cardon policy denied the transaction: ${denial}`);
    this.name = "CardonPolicyDeniedError";
  }
}

/** Thrown when RPC/Helius simulation says the tx would fail on-chain. */
export class CardonSimulationError extends Error {
  constructor(
    readonly logs: string[],
    readonly errString: string
  ) {
    super(`Cardon simulation failed: ${errString}`);
    this.name = "CardonSimulationError";
  }
}

export interface ResolvedIntent {
  lamports: BN;
  targetProgram: PublicKey;
}

export interface CardonWalletConfig {
  /** The agent's real wallet that ultimately signs/sends. */
  inner: BaseWallet;
  /** Client for the Cardon program (with its own funded fee payer). */
  client: CardonClient;
  /** The agent PDA registered on the Cardon program. */
  agent: PublicKey;
  /** The registered agent signing key (signs the Cardon submit instructions). */
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
  onReview?: (error: CardonReviewRequiredError) => void;
}

/**
 * A `BaseWallet` wrapper that runs every transaction through the Cardon
 * firewall before the inner wallet signs or sends it. This is the drop-in
 * integration point for a Solana Agent Kit agent:
 *
 * ```ts
 * const wallet = new CardonWallet({ inner, client, agent, agentSigner });
 * const agentKit = new SolanaAgentKit(wallet, RPC, {});
 * ```
 */
export class CardonWallet implements BaseWallet {
  constructor(private readonly cfg: CardonWalletConfig) {}

  get publicKey(): PublicKey {
    return this.cfg.inner.publicKey;
  }

  private resolve(tx: Transaction | VersionedTransaction): ResolvedIntent {
    const override = this.cfg.resolveIntent?.(tx);
    if (override) return override;

    const intent = extractIntent(tx);
    if (!intent.targetProgram) {
      throw new Error(
        "Cardon: could not determine the target program from the transaction; supply resolveIntent()"
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
        throw new CardonPolicyDeniedError(result.denial);
      case "simulation_failed":
        throw new CardonSimulationError(result.logs, result.err);
      case "queued": {
        const error = new CardonReviewRequiredError(
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
      throw new Error("Cardon: inner wallet does not implement sendTransaction");
    }
    await this.enforce(transaction);
    return this.cfg.inner.sendTransaction(transaction);
  };

  signMessage(message: Uint8Array): Promise<Uint8Array> {
    return this.cfg.inner.signMessage(message);
  }
}
