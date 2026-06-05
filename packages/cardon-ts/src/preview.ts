import { PublicKey } from "@solana/web3.js";
import BN from "bn.js";

/** Rolling volume window, matching the on-chain `VOLUME_WINDOW_SECS`. */
export const VOLUME_WINDOW_SECS = 86_400;

export enum PolicyOutcome {
  AutoApprove = "auto_approve",
  HumanReview = "human_review",
}

export enum PolicyDenial {
  Disabled = "disabled",
  OverPerTxCap = "over_per_tx_cap",
  ProgramNotAllowed = "program_not_allowed",
  OverDailyVolume = "over_daily_volume",
}

/** The subset of `Policy` fields the preview needs (an Anchor-fetched policy account satisfies this). */
export interface PolicyView {
  maxLamportsPerTx: BN;
  hitlThresholdLamports: BN;
  dailyVolumeCeiling: BN;
  volumeToday: BN;
  volumeWindowStart: BN;
  allowedPrograms: PublicKey[];
}

export type PreviewResult =
  | { kind: "ok"; outcome: PolicyOutcome }
  | { kind: "denied"; denial: PolicyDenial };

/**
 * Pure, client-side mirror of the on-chain policy check
 * (`cardon_rs::outcome::preview`). Lets an agent decide locally whether a tx
 * will auto-approve, need human review, or be rejected — before paying for a
 * transaction.
 */
export function preview(
  policy: PolicyView,
  agentEnabled: boolean,
  lamports: BN,
  targetProgram: PublicKey,
  nowUnix: BN | number
): PreviewResult {
  const now = BN.isBN(nowUnix) ? nowUnix : new BN(nowUnix);

  if (!agentEnabled) {
    return { kind: "denied", denial: PolicyDenial.Disabled };
  }
  if (lamports.gt(policy.maxLamportsPerTx)) {
    return { kind: "denied", denial: PolicyDenial.OverPerTxCap };
  }
  if (!policy.allowedPrograms.some((p) => p.equals(targetProgram))) {
    return { kind: "denied", denial: PolicyDenial.ProgramNotAllowed };
  }
  if (wouldExceedVolume(policy, lamports, now)) {
    return { kind: "denied", denial: PolicyDenial.OverDailyVolume };
  }
  if (lamports.lte(policy.hitlThresholdLamports)) {
    return { kind: "ok", outcome: PolicyOutcome.AutoApprove };
  }
  return { kind: "ok", outcome: PolicyOutcome.HumanReview };
}

function wouldExceedVolume(policy: PolicyView, lamports: BN, now: BN): boolean {
  const windowExpired = now
    .sub(policy.volumeWindowStart)
    .gte(new BN(VOLUME_WINDOW_SECS));
  const projected = windowExpired ? lamports : policy.volumeToday.add(lamports);
  return projected.gt(policy.dailyVolumeCeiling);
}
