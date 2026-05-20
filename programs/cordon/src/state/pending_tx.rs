use anchor_lang::prelude::*;

#[repr(u8)]
#[derive(Clone, Copy, AnchorSerialize, AnchorDeserialize, PartialEq, Eq, InitSpace)]
pub enum PendingStatus {
    Pending = 0,
    Approved = 1,
    Rejected = 2,
}

#[account]
#[derive(InitSpace)]
pub struct PendingTx {
    pub agent: Pubkey,
    pub tx_hash: [u8; 32],
    pub lamports: u64,
    pub target_program: Pubkey,
    pub nonce: u64,
    pub proposed_at: i64,
    pub status: PendingStatus,
    pub bump: u8,
}

impl PendingTx {
    pub const SEED_PREFIX: &'static [u8] = b"pending";
}
