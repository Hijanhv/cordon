import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

import type { Cordon } from "@/idl/cordon";
import cordonIdl from "@/idl/cordon.json";

export const CORDON_PROGRAM_ID = new PublicKey(
  "syCBdUmwQVcxUekupYBvPTM28HgCYN4pqehYaAktuik"
);

export type CordonProgram = Program<Cordon>;
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

export interface PolicyAccount {
  agent: PublicKey;
  authority: PublicKey;
  maxLamportsPerTx: BN;
  hitlThresholdLamports: BN;
  dailyVolumeCeiling: BN;
  volumeToday: BN;
  volumeWindowStart: BN;
  allowedPrograms: PublicKey[];
  updatedAt: BN;
}

export function getProvider(
  connection: Connection,
  wallet: AnchorWallet
): AnchorProvider {
  return new AnchorProvider(connection, wallet, AnchorProvider.defaultOptions());
}

export function loadProgram(provider: AnchorProvider): CordonProgram {
  return new Program(cordonIdl as Cordon, provider);
}

function decodeStatus(raw: { pending?: {}; approved?: {}; rejected?: {} }): PendingStatus {
  if ("pending" in raw) return "pending";
  if ("approved" in raw) return "approved";
  return "rejected";
}

export async function fetchPendingForAgent(
  program: CordonProgram,
  agent: PublicKey
): Promise<PendingTxAccount[]> {
  const all = await program.account.pendingTx.all([
    {
      memcmp: { offset: 8, bytes: agent.toBase58() },
    },
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

export async function fetchPolicy(
  program: CordonProgram,
  agent: PublicKey
): Promise<PolicyAccount> {
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.toBuffer()],
    CORDON_PROGRAM_ID
  );
  return (await program.account.policy.fetch(policyPda)) as unknown as PolicyAccount;
}
