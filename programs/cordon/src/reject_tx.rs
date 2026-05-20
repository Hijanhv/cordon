use anchor_lang::prelude::*;

use crate::errors::CordonError;
use crate::events::TxRejected;
use crate::state::{Agent, PendingStatus, PendingTx};

#[derive(Accounts)]
pub struct RejectTx<'info> {
    pub authority: Signer<'info>,

    /// CHECK: receives rent refund when the pending tx closes
    #[account(mut)]
    pub rent_receiver: UncheckedAccount<'info>,

    #[account(
        seeds = [Agent::SEED_PREFIX, agent.agent_signer.as_ref()],
        bump = agent.bump,
        has_one = authority,
    )]
    pub agent: Account<'info, Agent>,

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

pub fn handler(ctx: Context<RejectTx>, reason_code: u8) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let pending = &mut ctx.accounts.pending;
    pending.status = PendingStatus::Rejected;

    emit!(TxRejected {
        agent: ctx.accounts.agent.key(),
        pending: pending.key(),
        authority: ctx.accounts.authority.key(),
        tx_hash: pending.tx_hash,
        reason_code,
        timestamp: now,
    });

    Ok(())
}
