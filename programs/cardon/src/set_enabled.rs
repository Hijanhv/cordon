use anchor_lang::prelude::*;

use crate::events::AgentEnabledChanged;
use crate::state::Agent;

#[derive(Accounts)]
pub struct SetEnabled<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [Agent::SEED_PREFIX, agent.agent_signer.as_ref()],
        bump = agent.bump,
        has_one = authority,
    )]
    pub agent: Account<'info, Agent>,
}

pub fn handler(ctx: Context<SetEnabled>, enabled: bool) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let agent = &mut ctx.accounts.agent;
    agent.enabled = enabled;

    emit!(AgentEnabledChanged {
        agent: agent.key(),
        authority: ctx.accounts.authority.key(),
        enabled,
        timestamp: now,
    });

    Ok(())
}
