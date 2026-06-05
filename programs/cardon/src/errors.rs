use anchor_lang::prelude::*;

#[error_code]
pub enum CardonError {
    #[msg("Agent is disabled by its authority")]
    AgentDisabled,

    #[msg("Transaction exceeds the per-transaction lamport cap")]
    OverPerTxCap,

    #[msg("Target program is not in the allowlist")]
    ProgramNotAllowed,

    #[msg("Transaction would exceed the rolling 24h volume ceiling")]
    OverDailyVolume,

    #[msg("Policy must set hitl_threshold <= max_lamports_per_tx")]
    InvalidThresholdOrdering,

    #[msg("Allowed-programs list is over the size limit")]
    AllowlistTooLong,

    #[msg("Pending tx is not in the pending state")]
    NotPending,

    #[msg("Pending tx PDA does not match its agent")]
    PendingAgentMismatch,
}
