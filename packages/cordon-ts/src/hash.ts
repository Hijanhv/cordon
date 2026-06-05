import { sha256 } from "js-sha256";

/**
 * SHA-256 of a serialized transaction message, as a 32-element byte array —
 * the audit reference stored on-chain. Mirrors `cordon_rs::hash::tx_hash`.
 */
export function txHash(serializedMessage: Uint8Array | number[]): number[] {
  return sha256.array(serializedMessage as Uint8Array);
}
