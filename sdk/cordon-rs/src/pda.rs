use anchor_lang::prelude::Pubkey;
use cordon::state::{Agent, PendingTx, Policy};
use cordon::ID;

pub fn find_agent_pda(agent_signer: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[Agent::SEED_PREFIX, agent_signer.as_ref()], &ID)
}

pub fn find_policy_pda(agent: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[Policy::SEED_PREFIX, agent.as_ref()], &ID)
}

pub fn find_pending_pda(agent: &Pubkey, nonce: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[PendingTx::SEED_PREFIX, agent.as_ref(), &nonce.to_le_bytes()],
        &ID,
    )
}
