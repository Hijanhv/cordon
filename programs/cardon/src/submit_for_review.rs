use anchor_lang::prelude::*;

use crate::errors::CardonError;
use crate::events::TxQueuedForReview;
use crate::state::{Agent, PendingStatus, PendingTx, Policy};

#[derive(Accounts)]
#[instruction(tx_hash: [u8; 32], lamports: u64, target_program: Pubkey)]
pub struct SubmitForReview<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    pub agent_signer: Signer<'info>,

    #[account(
        mut,
        seeds = [Agent::SEED_PREFIX, agent_signer.key().as_ref()],
        bump = agent.bump,
        has_one = agent_signer,
        has_one = policy,
    )]
    pub agent: Account<'info, Agent>,

    #[account(
        seeds = [Policy::SEED_PREFIX, agent.key().as_ref()],
        bump = policy.bump,
    )]
    pub policy: Account<'info, Policy>,

    #[account(
        init,
        payer = payer,
        space = 8 + PendingTx::INIT_SPACE,
        seeds = [
            PendingTx::SEED_PREFIX,
            agent.key().as_ref(),
            agent.next_pending_nonce.to_le_bytes().as_ref(),
        ],
        bump,
    )]
    pub pending: Account<'info, PendingTx>,

    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<SubmitForReview>,
    tx_hash: [u8; 32],
    lamports: u64,
    target_program: Pubkey,
) -> Result<()> {
    let agent = &mut ctx.accounts.agent;
    require!(agent.enabled, CardonError::AgentDisabled);

    let policy = &ctx.accounts.policy;
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

    let nonce = agent.next_pending_nonce;
    agent.next_pending_nonce = nonce.checked_add(1).unwrap();

    let pending = &mut ctx.accounts.pending;
    pending.agent = agent.key();
    pending.tx_hash = tx_hash;
    pending.lamports = lamports;
    pending.target_program = target_program;
    pending.nonce = nonce;
    pending.proposed_at = now;
    pending.status = PendingStatus::Pending;
    pending.bump = ctx.bumps.pending;

    emit!(TxQueuedForReview {
        agent: agent.key(),
        pending: pending.key(),
        tx_hash,
        lamports,
        target_program,
        nonce,
        timestamp: now,
    });

    Ok(())
}
