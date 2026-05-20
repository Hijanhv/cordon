use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Agent {
    pub agent_signer: Pubkey,
    pub authority: Pubkey,
    pub policy: Pubkey,
    pub next_pending_nonce: u64,
    pub enabled: bool,
    pub created_at: i64,
    pub bump: u8,
}

impl Agent {
    pub const SEED_PREFIX: &'static [u8] = b"agent";
}
