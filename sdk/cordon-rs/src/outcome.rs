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

#[cfg(test)]
mod tests {
    use super::*;

    const NOW: i64 = 1_700_000_000;

    fn policy(allowed: &[Pubkey]) -> Policy {
        Policy {
            agent: Pubkey::new_from_array([1; 32]),
            authority: Pubkey::new_from_array([2; 32]),
            max_lamports_per_tx: 1_000,
            hitl_threshold_lamports: 100,
            daily_volume_ceiling: 5_000,
            volume_today: 0,
            volume_window_start: NOW,
            allowed_programs: allowed.to_vec(),
            updated_at: NOW,
            bump: 255,
        }
    }

    #[test]
    fn disabled_agent_is_denied() {
        let prog = Pubkey::new_unique();
        let p = policy(&[prog]);
        assert_eq!(preview(&p, false, 10, &prog, NOW), Err(PolicyDenial::Disabled));
    }

    #[test]
    fn over_per_tx_cap_is_denied() {
        let prog = Pubkey::new_unique();
        let p = policy(&[prog]);
        assert_eq!(
            preview(&p, true, 1_001, &prog, NOW),
            Err(PolicyDenial::OverPerTxCap)
        );
    }

    #[test]
    fn disallowed_program_is_denied() {
        let p = policy(&[Pubkey::new_unique()]);
        assert_eq!(
            preview(&p, true, 10, &Pubkey::new_unique(), NOW),
            Err(PolicyDenial::ProgramNotAllowed)
        );
    }

    #[test]
    fn over_daily_volume_is_denied() {
        let prog = Pubkey::new_unique();
        let mut p = policy(&[prog]);
        p.volume_today = 4_900;
        assert_eq!(
            preview(&p, true, 200, &prog, NOW),
            Err(PolicyDenial::OverDailyVolume)
        );
    }

    #[test]
    fn under_threshold_auto_approves() {
        let prog = Pubkey::new_unique();
        let p = policy(&[prog]);
        assert_eq!(preview(&p, true, 100, &prog, NOW), Ok(PolicyOutcome::AutoApprove));
    }

    #[test]
    fn over_threshold_under_cap_needs_review() {
        let prog = Pubkey::new_unique();
        let p = policy(&[prog]);
        assert_eq!(
            preview(&p, true, 500, &prog, NOW),
            Ok(PolicyOutcome::HumanReview)
        );
    }

    #[test]
    fn stale_volume_window_resets_for_preview() {
        let prog = Pubkey::new_unique();
        let mut p = policy(&[prog]);
        p.volume_today = 4_900;
        // A day later the rolling window has rolled over, so the spend fits.
        let later = NOW + 86_401;
        assert_eq!(
            preview(&p, true, 200, &prog, later),
            Ok(PolicyOutcome::HumanReview)
        );
    }
}
