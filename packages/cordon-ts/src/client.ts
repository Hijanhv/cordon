import {
  AnchorProvider,
  Program,
  BN,
  type Wallet,
} from "@coral-xyz/anchor";
import {
  Connection,
  PublicKey,
  Signer,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  type SimulatedTransactionResponse,
} from "@solana/web3.js";

import type { Cordon } from "./idl/cordon";
import cordonIdl from "./idl/cordon.json";
import { CORDON_PROGRAM_ID, findPendingPda, findPolicyPda } from "./pda";
import { preview, PolicyDenial, PolicyOutcome } from "./preview";
import { txHash } from "./hash";

export type PendingStatus = "pending" | "approved" | "rejected";

export interface PendingTxAccount {
  publicKey: PublicKey;
  agent: PublicKey;
  txHash: number[];
  lamports: BN;
  targetProgram: PublicKey;
  nonce: BN;
  proposedAt: BN;
  status: PendingStatus;
}

/** A transaction the agent wants to broadcast, in the terms the policy cares about. */
export interface Candidate {
  lamports: BN;
  targetProgram: PublicKey;
  /** Optional real instructions; simulated before submit and hashed for the audit log. */
  instructions?: TransactionInstruction[];
  /** Override the audit hash instead of deriving it from `instructions`. */
  txHash?: number[];
}

export type GuardResult =
  | { kind: "auto_approved"; signature: string; txHash: number[] }
  | {
      kind: "queued";
      signature: string;
      pending: PublicKey;
      nonce: BN;
      txHash: number[];
    }
  | { kind: "denied"; denial: PolicyDenial }
  | { kind: "simulation_failed"; err: string; logs: string[] };

function decodeStatus(raw: {
  pending?: object;
  approved?: object;
  rejected?: object;
}): PendingStatus {
  if ("pending" in raw) return "pending";
  if ("approved" in raw) return "approved";
  return "rejected";
}

/**
 * TypeScript client over the Cordon Anchor program — the off-chain spine of the
 * firewall. Mirrors `cordon_rs::client::CordonClient`.
 */
export class CordonClient {
  readonly program: Program<Cordon>;
  readonly provider: AnchorProvider;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(cordonIdl as Cordon, provider);
  }

  static fromConnection(
    connection: Connection,
    wallet: Wallet,
    opts = AnchorProvider.defaultOptions()
  ): CordonClient {
    return new CordonClient(new AnchorProvider(connection, wallet, opts));
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get connection(): Connection {
    return this.provider.connection;
  }

  get payer(): PublicKey {
    return this.provider.wallet.publicKey;
  }

  // --- account fetches -------------------------------------------------

  fetchAgent(agent: PublicKey) {
    return this.program.account.agent.fetch(agent);
  }

  fetchPolicy(agent: PublicKey) {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.account.policy.fetch(policy);
  }

  fetchPending(pending: PublicKey) {
    return this.program.account.pendingTx.fetch(pending);
  }

  /** Still-pending `PendingTx` accounts for an agent, oldest first. */
  async pendingForAgent(agent: PublicKey): Promise<PendingTxAccount[]> {
    const all = await this.program.account.pendingTx.all([
      { memcmp: { offset: 8, bytes: agent.toBase58() } },
    ]);
    return all
      .map(({ publicKey, account }) => ({
        publicKey,
        agent: account.agent,
        txHash: account.txHash,
        lamports: account.lamports,
        targetProgram: account.targetProgram,
        nonce: account.nonce,
        proposedAt: account.proposedAt,
        status: decodeStatus(account.status),
      }))
      .filter((p) => p.status === "pending")
      .sort((a, b) => a.proposedAt.cmp(b.proposedAt));
  }

  // --- Helius / RPC simulation hook ------------------------------------

  /** Simulate instructions against the connected RPC (Helius or any other). */
  async simulate(
    instructions: TransactionInstruction[],
    payer: PublicKey = this.payer
  ): Promise<SimulatedTransactionResponse> {
    const { blockhash } = await this.connection.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: payer,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);
    const res = await this.connection.simulateTransaction(tx, {
      sigVerify: false,
      replaceRecentBlockhash: true,
    });
    return res.value;
  }

  // --- the firewall path -----------------------------------------------

  async guard(
    agentSigner: Signer,
    agent: PublicKey,
    candidate: Candidate
  ): Promise<GuardResult> {
    const agentAccount = await this.fetchAgent(agent);
    const policy = await this.fetchPolicy(agent);

    const result = preview(
      policy,
      agentAccount.enabled,
      candidate.lamports,
      candidate.targetProgram,
      Math.floor(Date.now() / 1000)
    );
    if (result.kind === "denied") {
      return { kind: "denied", denial: result.denial };
    }

    if (candidate.instructions && candidate.instructions.length > 0) {
      const sim = await this.simulate(candidate.instructions);
      if (sim.err) {
        return {
          kind: "simulation_failed",
          err: JSON.stringify(sim.err),
          logs: sim.logs ?? [],
        };
      }
    }

    const hash = candidate.txHash ?? this.deriveHash(candidate.instructions ?? []);

    if (result.outcome === PolicyOutcome.AutoApprove) {
      const signature = await this.submitAuto(
        agentSigner,
        agent,
        hash,
        candidate.lamports,
        candidate.targetProgram
      );
      return { kind: "auto_approved", signature, txHash: hash };
    }

    const queued = await this.submitForReview(
      agentSigner,
      agent,
      hash,
      candidate.lamports,
      candidate.targetProgram
    );
    return {
      kind: "queued",
      signature: queued.signature,
      pending: queued.pending,
      nonce: queued.nonce,
      txHash: hash,
    };
  }

  private deriveHash(instructions: TransactionInstruction[]): number[] {
    const tx = new Transaction();
    if (instructions.length > 0) tx.add(...instructions);
    tx.feePayer = this.payer;
    tx.recentBlockhash = PublicKey.default.toBase58();
    return txHash(tx.serializeMessage());
  }

  // --- instruction builders --------------------------------------------

  async registerAgent(params: {
    authority: PublicKey;
    agentSigner: PublicKey;
    agent: PublicKey;
    maxLamportsPerTx: BN;
    hitlThresholdLamports: BN;
    dailyVolumeCeiling: BN;
    allowedPrograms: PublicKey[];
  }): Promise<string> {
    const [policy] = findPolicyPda(params.agent, this.programId);
    return this.program.methods
      .registerAgent(
        params.maxLamportsPerTx,
        params.hitlThresholdLamports,
        params.dailyVolumeCeiling,
        params.allowedPrograms
      )
      .accountsStrict({
        payer: this.payer,
        authority: params.authority,
        agentSigner: params.agentSigner,
        agent: params.agent,
        policy,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async setPolicy(
    authority: Signer,
    agent: PublicKey,
    maxLamportsPerTx: BN,
    hitlThresholdLamports: BN,
    dailyVolumeCeiling: BN,
    allowedPrograms: PublicKey[]
  ): Promise<string> {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.methods
      .setPolicy(
        maxLamportsPerTx,
        hitlThresholdLamports,
        dailyVolumeCeiling,
        allowedPrograms
      )
      .accountsStrict({ authority: authority.publicKey, agent, policy })
      .signers([authority])
      .rpc();
  }

  async setEnabled(
    authority: Signer,
    agent: PublicKey,
    enabled: boolean
  ): Promise<string> {
    return this.program.methods
      .setEnabled(enabled)
      .accountsStrict({ authority: authority.publicKey, agent })
      .signers([authority])
      .rpc();
  }

  async submitAuto(
    agentSigner: Signer,
    agent: PublicKey,
    hash: number[],
    lamports: BN,
    targetProgram: PublicKey
  ): Promise<string> {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.methods
      .submitAuto(hash, lamports, targetProgram)
      .accountsStrict({ agentSigner: agentSigner.publicKey, agent, policy })
      .signers([agentSigner])
      .rpc();
  }

  async submitForReview(
    agentSigner: Signer,
    agent: PublicKey,
    hash: number[],
    lamports: BN,
    targetProgram: PublicKey
  ): Promise<{ signature: string; pending: PublicKey; nonce: BN }> {
    const agentAccount = await this.fetchAgent(agent);
    const nonce = agentAccount.nextPendingNonce;
    const [policy] = findPolicyPda(agent, this.programId);
    const [pending] = findPendingPda(agent, nonce, this.programId);
    const signature = await this.program.methods
      .submitForReview(hash, lamports, targetProgram)
      .accountsStrict({
        payer: this.payer,
        agentSigner: agentSigner.publicKey,
        agent,
        policy,
        pending,
        systemProgram: SystemProgram.programId,
      })
      .signers([agentSigner])
      .rpc();
    return { signature, pending, nonce };
  }

  async approveTx(
    authority: Signer,
    agent: PublicKey,
    pending: PublicKey,
    rentReceiver: PublicKey
  ): Promise<string> {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.methods
      .approveTx()
      .accountsStrict({
        authority: authority.publicKey,
        rentReceiver,
        agent,
        policy,
        pending,
      })
      .signers([authority])
      .rpc();
  }

  async rejectTx(
    authority: Signer,
    agent: PublicKey,
    pending: PublicKey,
    rentReceiver: PublicKey,
    reasonCode: number
  ): Promise<string> {
    return this.program.methods
      .rejectTx(reasonCode)
      .accountsStrict({
        authority: authority.publicKey,
        rentReceiver,
        agent,
        pending,
      })
      .signers([authority])
      .rpc();
  }

  // --- instruction-only builders ---------------------------------------
  //
  // Return the raw instruction (no signer, no send) so it can be wrapped by a
  // governance flow such as a Squads multisig proposal, where `authority` is a
  // PDA that signs via CPI rather than a local keypair.

  approveTxInstruction(
    authority: PublicKey,
    agent: PublicKey,
    pending: PublicKey,
    rentReceiver: PublicKey
  ): Promise<TransactionInstruction> {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.methods
      .approveTx()
      .accountsStrict({ authority, rentReceiver, agent, policy, pending })
      .instruction();
  }

  rejectTxInstruction(
    authority: PublicKey,
    agent: PublicKey,
    pending: PublicKey,
    rentReceiver: PublicKey,
    reasonCode: number
  ): Promise<TransactionInstruction> {
    return this.program.methods
      .rejectTx(reasonCode)
      .accountsStrict({ authority, rentReceiver, agent, pending })
      .instruction();
  }

  setPolicyInstruction(
    authority: PublicKey,
    agent: PublicKey,
    maxLamportsPerTx: BN,
    hitlThresholdLamports: BN,
    dailyVolumeCeiling: BN,
    allowedPrograms: PublicKey[]
  ): Promise<TransactionInstruction> {
    const [policy] = findPolicyPda(agent, this.programId);
    return this.program.methods
      .setPolicy(
        maxLamportsPerTx,
        hitlThresholdLamports,
        dailyVolumeCeiling,
        allowedPrograms
      )
      .accountsStrict({ authority, agent, policy })
      .instruction();
  }
}
