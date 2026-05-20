use anchor_lang::prelude::*;

use crate::errors::CordonError;
use crate::events::PolicyUpdated;
use crate::state::{Agent, Policy, MAX_ALLOWED_PROGRAMS};

#[derive(Accounts)]
pub struct SetPolicy<'info> {
    pub authority: Signer<'info>,

    #[account(
        seeds = [Agent::SEED_PREFIX, agent.agent_signer.as_ref()],
        bump = agent.bump,
        has_one = authority,
        has_one = policy,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        mut,
        seeds = [Policy::SEED_PREFIX, agent.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,
}

pub fn handler(
    ctx: Context<SetPolicy>,
    max_lamports_per_tx: u64,
    hitl_threshold_lamports: u64,
    daily_volume_ceiling: u64,
    allowed_programs: Vec<Pubkey>,
) -> Result<()> {
    require!(
        hitl_threshold_lamports <= max_lamports_per_tx,
        CordonError::InvalidThresholdOrdering
    );
    require!(
        allowed_programs.len() <= MAX_ALLOWED_PROGRAMS,
        CordonError::AllowlistTooLong
    );

    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;
    policy.max_lamports_per_tx = max_lamports_per_tx;
    policy.hitl_threshold_lamports = hitl_threshold_lamports;
    policy.daily_volume_ceiling = daily_volume_ceiling;
    policy.allowed_programs = allowed_programs;
    policy.updated_at = now;

    emit!(PolicyUpdated {
        policy: policy.key(),
        authority: policy.authority,
        max_lamports_per_tx,
        hitl_threshold_lamports,
        daily_volume_ceiling,
        timestamp: now,
    });

    Ok(())
}
