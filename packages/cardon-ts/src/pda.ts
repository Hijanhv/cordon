import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** The deployed Cardon program ID (matches `declare_id!` and Anchor.toml). */
export const CARDON_PROGRAM_ID = new PublicKey(
  "5Zy73PLH2hpNvsCvyeqpn2tKjHBXNihjX7UbeAZ41tQc"
);

const AGENT_SEED = Buffer.from("agent");
const POLICY_SEED = Buffer.from("policy");
const PENDING_SEED = Buffer.from("pending");

export function findAgentPda(
  agentSigner: PublicKey,
  programId: PublicKey = CARDON_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [AGENT_SEED, agentSigner.toBuffer()],
    programId
  );
}

export function findPolicyPda(
  agent: PublicKey,
  programId: PublicKey = CARDON_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [POLICY_SEED, agent.toBuffer()],
    programId
  );
}

export function findPendingPda(
  agent: PublicKey,
  nonce: BN | number,
  programId: PublicKey = CARDON_PROGRAM_ID
): [PublicKey, number] {
  const nonceBn = BN.isBN(nonce) ? nonce : new BN(nonce);
  const nonceBytes = nonceBn.toArrayLike(Buffer, "le", 8);
  return PublicKey.findProgramAddressSync(
    [PENDING_SEED, agent.toBuffer(), nonceBytes],
    programId
  );
}
