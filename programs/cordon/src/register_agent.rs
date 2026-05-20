use anchor_lang::prelude::*;

use crate::errors::CordonError;
use crate::events::{AgentRegistered, PolicyUpdated};
use crate::state::{Agent, Policy, MAX_ALLOWED_PROGRAMS};

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub authority: SystemAccount<'info>,

    pub agent_signer: SystemAccount<'info>,

    #[account(
        init,
        payer = payer,
        space = 8 + Agent::INIT_SPACE,
        seeds = [Agent::SEED_PREFIX, agent_signer.key().as_ref()],
        bump,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        init,
        payer = payer,
        space = 8 + Policy::INIT_SPACE,
        seeds = [Policy::SEED_PREFIX, agent.key().as_ref()],
        bump,
    )]
    pub policy: Account<'info, Policy>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<RegisterAgent>,
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

    let agent = &mut ctx.accounts.agent;
    agent.agent_signer = ctx.accounts.agent_signer.key();
    agent.authority = ctx.accounts.authority.key();
    agent.policy = ctx.accounts.policy.key();
    agent.next_pending_nonce = 0;
    agent.enabled = true;
    agent.created_at = now;
    agent.bump = ctx.bumps.agent;

    let policy = &mut ctx.accounts.policy;
    policy.agent = agent.key();
    policy.authority = ctx.accounts.authority.key();
    policy.max_lamports_per_tx = max_lamports_per_tx;
    policy.hitl_threshold_lamports = hitl_threshold_lamports;
    policy.daily_volume_ceiling = daily_volume_ceiling;
    policy.volume_today = 0;
    policy.volume_window_start = now;
    policy.allowed_programs = allowed_programs;
    policy.updated_at = now;
    policy.bump = ctx.bumps.policy;

    emit!(AgentRegistered {
        agent: agent.key(),
        authority: agent.authority,
        policy: policy.key(),
        timestamp: now,
    });

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
