use anchor_lang::prelude::*;

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub policy: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct PolicyUpdated {
    pub policy: Pubkey,
    pub authority: Pubkey,
    pub max_lamports_per_tx: u64,
    pub hitl_threshold_lamports: u64,
    pub daily_volume_ceiling: u64,
    pub timestamp: i64,
}

#[event]
pub struct TxAutoApproved {
    pub agent: Pubkey,
    pub tx_hash: [u8; 32],
    pub lamports: u64,
    pub target_program: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TxQueuedForReview {
    pub agent: Pubkey,
    pub pending: Pubkey,
    pub tx_hash: [u8; 32],
    pub lamports: u64,
    pub target_program: Pubkey,
    pub nonce: u64,
    pub timestamp: i64,
}

#[event]
pub struct TxHumanApproved {
    pub agent: Pubkey,
    pub pending: Pubkey,
    pub authority: Pubkey,
    pub tx_hash: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct TxRejected {
    pub agent: Pubkey,
    pub pending: Pubkey,
    pub authority: Pubkey,
    pub tx_hash: [u8; 32],
    pub reason_code: u8,
    pub timestamp: i64,
}

#[event]
pub struct AgentEnabledChanged {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub enabled: bool,
    pub timestamp: i64,
}
