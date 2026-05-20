import { AnchorProvider, Program, Idl, BN } from "@coral-xyz/anchor";
import { Connection, PublicKey } from "@solana/web3.js";
import type { AnchorWallet } from "@solana/wallet-adapter-react";

export const CORDON_PROGRAM_ID = new PublicKey(
  "syCBdUmwQVcxUekupYBvPTM28HgCYN4pqehYaAktuik"
);

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

export async function loadProgram(
  provider: AnchorProvider
): Promise<Program<Idl>> {
  const idl = await Program.fetchIdl(CORDON_PROGRAM_ID, provider);
  if (!idl) {
    throw new Error(
      `Cordon IDL not found on-chain at ${CORDON_PROGRAM_ID.toBase58()}`
    );
  }
  return new Program(idl, provider);
}

function decodeStatus(raw: { pending?: {}; approved?: {}; rejected?: {} }): PendingStatus {
  if ("pending" in raw) return "pending";
  if ("approved" in raw) return "approved";
  return "rejected";
}

export async function fetchPendingForAgent(
  program: Program<Idl>,
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
      agent: account.agent as PublicKey,
      txHash: account.txHash as number[],
      lamports: account.lamports as BN,
      targetProgram: account.targetProgram as PublicKey,
      nonce: account.nonce as BN,
      proposedAt: account.proposedAt as BN,
      status: decodeStatus(account.status as any),
    }))
    .filter((p) => p.status === "pending")
    .sort((a, b) => a.proposedAt.cmp(b.proposedAt));
}

export async function fetchPolicy(
  program: Program<Idl>,
  agent: PublicKey
): Promise<PolicyAccount> {
  const [policyPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("policy"), agent.toBuffer()],
    CORDON_PROGRAM_ID
  );
  const policy = await program.account.policy.fetch(policyPda);
  return policy as unknown as PolicyAccount;
}
