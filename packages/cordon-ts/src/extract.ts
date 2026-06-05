import {
  PublicKey,
  SystemInstruction,
  SystemProgram,
  Transaction,
  TransactionInstruction,
  VersionedTransaction,
} from "@solana/web3.js";
import BN from "bn.js";

/** What the firewall needs to know about a candidate transaction. */
export interface ExtractedIntent {
  /** Every program the transaction invokes. */
  programIds: PublicKey[];
  /** Best-effort sum of SOL moved by SystemProgram transfers, in lamports. */
  lamports: BN;
  /** The primary non-system program invoked (the policy "target program"). */
  targetProgram: PublicKey | null;
}

/**
 * Best-effort extraction of the policy-relevant intent from a transaction.
 *
 * Legacy transactions are fully inspected (program ids + decoded SystemProgram
 * transfers). Versioned transactions yield program ids only; supply
 * `lamports`/`targetProgram` explicitly when guarding those.
 */
export function extractIntent(
  tx: Transaction | VersionedTransaction
): ExtractedIntent {
  if (tx instanceof VersionedTransaction) {
    return extractFromVersioned(tx);
  }
  return extractFromLegacy(tx);
}

function extractFromLegacy(tx: Transaction): ExtractedIntent {
  const programIds: PublicKey[] = [];
  let lamports = new BN(0);

  for (const ix of tx.instructions) {
    pushUnique(programIds, ix.programId);
    lamports = lamports.add(decodeTransferLamports(ix));
  }

  return {
    programIds,
    lamports,
    targetProgram: pickTarget(programIds),
  };
}

function extractFromVersioned(tx: VersionedTransaction): ExtractedIntent {
  const keys = tx.message.staticAccountKeys;
  const programIds: PublicKey[] = [];
  for (const ci of tx.message.compiledInstructions) {
    const programId = keys[ci.programIdIndex];
    if (programId) pushUnique(programIds, programId);
  }
  return {
    programIds,
    lamports: new BN(0),
    targetProgram: pickTarget(programIds),
  };
}

function decodeTransferLamports(ix: TransactionInstruction): BN {
  if (!ix.programId.equals(SystemProgram.programId)) return new BN(0);
  try {
    if (SystemInstruction.decodeInstructionType(ix) === "Transfer") {
      const { lamports } = SystemInstruction.decodeTransfer(ix);
      return new BN(lamports.toString());
    }
  } catch {
    // Not a decodable system instruction; ignore.
  }
  return new BN(0);
}

function pickTarget(programIds: PublicKey[]): PublicKey | null {
  return (
    programIds.find((p) => !p.equals(SystemProgram.programId)) ??
    programIds[0] ??
    null
  );
}

function pushUnique(list: PublicKey[], key: PublicKey): void {
  if (!list.some((p) => p.equals(key))) list.push(key);
}
