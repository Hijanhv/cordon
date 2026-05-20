use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod state;

mod approve_tx;
mod register_agent;
mod reject_tx;
mod set_enabled;
mod set_policy;
mod submit_auto;
mod submit_for_review;

pub use approve_tx::*;
pub use register_agent::*;
pub use reject_tx::*;
pub use set_enabled::*;
pub use set_policy::*;
pub use submit_auto::*;
pub use submit_for_review::*;

declare_id!("syCBdUmwQVcxUekupYBvPTM28HgCYN4pqehYaAktuik");

#[program]
pub mod cordon {
    use super::*;

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        max_lamports_per_tx: u64,
        hitl_threshold_lamports: u64,
        daily_volume_ceiling: u64,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<()> {
        crate::register_agent::handler(
            ctx,
            max_lamports_per_tx,
            hitl_threshold_lamports,
            daily_volume_ceiling,
            allowed_programs,
        )
    }

    pub fn set_policy(
        ctx: Context<SetPolicy>,
        max_lamports_per_tx: u64,
        hitl_threshold_lamports: u64,
        daily_volume_ceiling: u64,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<()> {
        crate::set_policy::handler(
            ctx,
            max_lamports_per_tx,
            hitl_threshold_lamports,
            daily_volume_ceiling,
            allowed_programs,
        )
    }

    pub fn submit_auto(
        ctx: Context<SubmitAuto>,
        tx_hash: [u8; 32],
        lamports: u64,
        target_program: Pubkey,
    ) -> Result<()> {
        crate::submit_auto::handler(ctx, tx_hash, lamports, target_program)
    }

    pub fn submit_for_review(
        ctx: Context<SubmitForReview>,
        tx_hash: [u8; 32],
        lamports: u64,
        target_program: Pubkey,
    ) -> Result<()> {
        crate::submit_for_review::handler(ctx, tx_hash, lamports, target_program)
    }

    pub fn approve_tx(ctx: Context<ApproveTx>) -> Result<()> {
        crate::approve_tx::handler(ctx)
    }

    pub fn reject_tx(ctx: Context<RejectTx>, reason_code: u8) -> Result<()> {
        crate::reject_tx::handler(ctx, reason_code)
    }

    pub fn set_enabled(ctx: Context<SetEnabled>, enabled: bool) -> Result<()> {
        crate::set_enabled::handler(ctx, enabled)
    }
}
