use anchor_lang::prelude::*;

use crate::errors::CordonError;
use crate::events::TxHumanApproved;
use crate::state::{Agent, PendingStatus, PendingTx, Policy};

#[derive(Accounts)]
pub struct ApproveTx<'info> {
    pub authority: Signer<'info>,

    /// CHECK: receives rent refund when the pending tx closes
    #[account(mut)]
    pub rent_receiver: UncheckedAccount<'info>,

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

    #[account(
        mut,
        close = rent_receiver,
        seeds = [
            PendingTx::SEED_PREFIX,
            agent.key().as_ref(),
            pending.nonce.to_le_bytes().as_ref(),
        ],
        bump = pending.bump,
        constraint = pending.agent == agent.key() @ CordonError::PendingAgentMismatch,
        constraint = pending.status == PendingStatus::Pending @ CordonError::NotPending,
    )]
    pub pending: Account<'info, PendingTx>,
}

pub fn handler(ctx: Context<ApproveTx>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let policy = &mut ctx.accounts.policy;
    let pending = &mut ctx.accounts.pending;

    require!(
        !policy.would_exceed_volume(pending.lamports, now),
        CordonError::OverDailyVolume
    );
    policy.account_for_spend(pending.lamports, now);

    pending.status = PendingStatus::Approved;

    emit!(TxHumanApproved {
        agent: ctx.accounts.agent.key(),
        pending: pending.key(),
        authority: ctx.accounts.authority.key(),
        tx_hash: pending.tx_hash,
        timestamp: now,
    });

    Ok(())
}
