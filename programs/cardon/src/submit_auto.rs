use anchor_lang::prelude::*;

use crate::errors::CardonError;
use crate::events::TxAutoApproved;
use crate::state::{Agent, Policy};

#[derive(Accounts)]
pub struct SubmitAuto<'info> {
    pub agent_signer: Signer<'info>,

    #[account(
        seeds = [Agent::SEED_PREFIX, agent_signer.key().as_ref()],
        bump = agent.bump,
        has_one = agent_signer,
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
    ctx: Context<SubmitAuto>,
    tx_hash: [u8; 32],
    lamports: u64,
    target_program: Pubkey,
) -> Result<()> {
    let agent = &ctx.accounts.agent;
    require!(agent.enabled, CardonError::AgentDisabled);

    let policy = &mut ctx.accounts.policy;
    require!(
        lamports <= policy.hitl_threshold_lamports,
        CardonError::OverPerTxCap
    );
    require!(
        lamports <= policy.max_lamports_per_tx,
        CardonError::OverPerTxCap
    );
    require!(
        policy.program_allowed(&target_program),
        CardonError::ProgramNotAllowed
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        !policy.would_exceed_volume(lamports, now),
        CardonError::OverDailyVolume
    );

    policy.account_for_spend(lamports, now);

    emit!(TxAutoApproved {
        agent: agent.key(),
        tx_hash,
        lamports,
        target_program,
        timestamp: now,
    });

    Ok(())
}
