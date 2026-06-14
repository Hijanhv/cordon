import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

import type { Cardon } from "@/idl/cardon";
import cardonIdl from "@/idl/cardon.json";

export const CARDON_PROGRAM_ID = new PublicKey(
  "5Zy73PLH2hpNvsCvyeqpn2tKjHBXNihjX7UbeAZ41tQc"
);

export type CardonProgram = Program<Cardon>;
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

export function loadProgram(provider: AnchorProvider): CardonProgram {
  return new Program(cardonIdl as Cardon, provider);
}

function decodeStatus(raw: { pending?: {}; approved?: {}; rejected?: {} }): PendingStatus {
  if ("pending" in raw) return "pending";
  if ("approved" in raw) return "approved";
  return "rejected";
}

export async function fetchPendingForAgent(
  program: CardonProgram,
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
  program: CardonProgram,
  agent: PublicKey
): Promise<PolicyAccount> {
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.toBuffer()],
    CARDON_PROGRAM_ID
  );
  return (await program.account.policy.fetch(policyPda)) as unknown as PolicyAccount;
}
