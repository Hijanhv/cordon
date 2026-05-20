use anchor_lang::prelude::Pubkey;
use cordon::state::Policy;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PolicyOutcome {
    AutoApprove,
    HumanReview,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Error)]
pub enum PolicyDenial {
    #[error("agent is disabled")]
    Disabled,
    #[error("transaction exceeds the per-tx lamport cap")]
    OverPerTxCap,
    #[error("target program is not in the allowlist")]
    ProgramNotAllowed,
    #[error("transaction would exceed the daily volume ceiling")]
    OverDailyVolume,
}

pub fn preview(
    policy: &Policy,
    agent_enabled: bool,
    lamports: u64,
    target_program: &Pubkey,
    now_unix: i64,
) -> Result<PolicyOutcome, PolicyDenial> {
    if !agent_enabled {
        return Err(PolicyDenial::Disabled);
    }
    if lamports > policy.max_lamports_per_tx {
        return Err(PolicyDenial::OverPerTxCap);
    }
    if !policy.program_allowed(target_program) {
        return Err(PolicyDenial::ProgramNotAllowed);
    }
    if policy.would_exceed_volume(lamports, now_unix) {
        return Err(PolicyDenial::OverDailyVolume);
    }
    if lamports <= policy.hitl_threshold_lamports {
        Ok(PolicyOutcome::AutoApprove)
    } else {
        Ok(PolicyOutcome::HumanReview)
    }
}
