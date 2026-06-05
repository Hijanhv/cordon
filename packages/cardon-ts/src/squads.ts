/**
 * Squads v4 multisig integration for Cardon.
 *
 * Cardon's policy `authority` is just a pubkey with a `has_one` check, so a
 * Squads multisig can govern a policy with **no change to the on-chain program**:
 *
 *  1. Register the agent with `authority = cardonPolicyAuthority(multisig)` (the
 *     Squads vault PDA).
 *  2. To approve/reject a queued tx (or change policy), wrap the Cardon
 *     instruction in a Squads vault transaction + proposal via
 *     {@link proposeCardonInstruction}.
 *  3. Members approve the proposal ({@link approveCardonProposal}); once the
 *     threshold is met, execute it ({@link executeCardonProposal}). Squads then
 *     CPIs the Cardon instruction, signing as the vault PDA.
 *
 * This makes the HITL approver a multisig (or DAO), so no single operator can
 * unilaterally approve an agent's transaction or loosen its policy.
 */
import {
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
} from "@solana/web3.js";
import * as multisig from "@sqds/multisig";

export interface CardonMultisig {
  /** The Squads multisig account PDA. */
  multisigPda: PublicKey;
  /** Vault authority index (defaults to 0 — the primary vault). */
  vaultIndex?: number;
}

/** The Squads vault PDA to register as the Cardon policy `authority`. */
export function cardonPolicyAuthority(ms: CardonMultisig): PublicKey {
  const [vaultPda] = multisig.getVaultPda({
    multisigPda: ms.multisigPda,
    index: ms.vaultIndex ?? 0,
  });
  return vaultPda;
}

export interface ProposeResult {
  vaultTransactionCreateIx: TransactionInstruction;
  proposalCreateIx: TransactionInstruction;
  /** The vault PDA that will sign the wrapped instruction on execution. */
  vaultPda: PublicKey;
}

/**
 * Wrap a Cardon instruction (whose `authority` is the Squads vault PDA) into a
 * Squads vault transaction + proposal. Send the two returned instructions to
 * create the proposal; members then approve and execute it.
 */
export function proposeCardonInstruction(params: {
  multisig: CardonMultisig;
  /** Monotonic Squads transaction index (multisig.transactionIndex + 1). */
  transactionIndex: bigint;
  /** Multisig member creating the proposal. */
  creator: PublicKey;
  rentPayer?: PublicKey;
  /** The Cardon instruction to execute through the multisig. */
  instruction: TransactionInstruction;
  memo?: string;
}): ProposeResult {
  const vaultPda = cardonPolicyAuthority(params.multisig);

  const transactionMessage = new TransactionMessage({
    payerKey: vaultPda,
    recentBlockhash: PublicKey.default.toBase58(),
    instructions: [params.instruction],
  });

  const vaultTransactionCreateIx = multisig.instructions.vaultTransactionCreate({
    multisigPda: params.multisig.multisigPda,
    transactionIndex: params.transactionIndex,
    creator: params.creator,
    rentPayer: params.rentPayer,
    vaultIndex: params.multisig.vaultIndex ?? 0,
    ephemeralSigners: 0,
    transactionMessage,
    memo: params.memo,
  });

  const proposalCreateIx = multisig.instructions.proposalCreate({
    multisigPda: params.multisig.multisigPda,
    creator: params.creator,
    rentPayer: params.rentPayer,
    transactionIndex: params.transactionIndex,
  });

  return { vaultTransactionCreateIx, proposalCreateIx, vaultPda };
}

/** A member's approval vote on a Cardon proposal. */
export function approveCardonProposal(params: {
  multisig: CardonMultisig;
  transactionIndex: bigint;
  member: PublicKey;
  memo?: string;
}): TransactionInstruction {
  return multisig.instructions.proposalApprove({
    multisigPda: params.multisig.multisigPda,
    transactionIndex: params.transactionIndex,
    member: params.member,
    memo: params.memo,
  });
}

/**
 * Build the execute instruction once a proposal has met threshold. Squads CPIs
 * the wrapped Cardon instruction, signing as the vault PDA.
 */
export function executeCardonProposal(params: {
  connection: Connection;
  multisig: CardonMultisig;
  transactionIndex: bigint;
  member: PublicKey;
}): Promise<{
  instruction: TransactionInstruction;
  lookupTableAccounts: unknown[];
}> {
  return multisig.instructions.vaultTransactionExecute({
    connection: params.connection,
    multisigPda: params.multisig.multisigPda,
    transactionIndex: params.transactionIndex,
    member: params.member,
  });
}

export {
  getMultisigPda,
  getVaultPda,
  getTransactionPda,
  getProposalPda,
} from "@sqds/multisig";
