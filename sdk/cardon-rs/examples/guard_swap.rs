//! Minimal example of putting a candidate transaction through the Cardon
//! firewall with the async client.
//!
//! Run against a local validator with the program deployed:
//!
//! ```bash
//! cargo run -p cardon-rs --features client --example guard_swap
//! ```
//!
//! Set `CARDON_RPC` (defaults to localhost) and `CARDON_PAYER` (path to a
//! keypair JSON, defaults to the standard Solana CLI keypair).

use std::sync::Arc;

use cardon_rs::client::{
    read_keypair_file, AccountMeta, Candidate, CardonClient, GuardOutcome, Instruction, Keypair,
    Pubkey, Signer,
};
use cardon_rs::find_agent_pda;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let rpc = std::env::var("CARDON_RPC").unwrap_or_else(|_| "http://127.0.0.1:8899".to_string());
    let payer_path = std::env::var("CARDON_PAYER").unwrap_or_else(|_| {
        let home = std::env::var("HOME").unwrap_or_default();
        format!("{home}/.config/solana/id.json")
    });

    let payer = Arc::new(read_keypair_file(&payer_path).map_err(|e| e.to_string())?);
    let client = CardonClient::new_with_rpc(rpc, payer)?;

    // The agent's signing key (would be the agent's hot wallet in practice).
    let agent_signer = Arc::new(Keypair::new());
    let (agent_pda, _) = find_agent_pda(&agent_signer.pubkey());

    // Pretend this is a Jupiter swap the agent wants to broadcast.
    let jupiter = Pubkey::new_unique();
    let swap_ix = Instruction {
        program_id: jupiter,
        accounts: vec![AccountMeta::new(agent_signer.pubkey(), true)],
        data: vec![],
    };

    let candidate = Candidate::new(50_000_000, jupiter).with_instructions(vec![swap_ix]);

    match client.guard(&agent_signer, agent_pda, &candidate).await {
        Ok(GuardOutcome::AutoApproved { signature, .. }) => {
            println!("auto-approved under threshold: {signature}");
        }
        Ok(GuardOutcome::Queued { pending, nonce, .. }) => {
            println!("queued for human review: pending={pending} nonce={nonce}");
        }
        Err(e) => {
            eprintln!("firewall blocked or errored: {e}");
        }
    }

    Ok(())
}
