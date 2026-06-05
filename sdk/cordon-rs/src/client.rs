//! Async on-chain client for the Cordon program.
//!
//! This is the firewall's off-chain spine: it fetches the on-chain policy,
//! runs the same [`crate::preview`] check the program enforces, simulates the
//! candidate transaction against an RPC (Helius or any other), and then routes
//! it to the fast `submit_auto` path or the human-review queue.
//!
//! Gated behind the `client` feature so the lightweight policy-preview, PDA,
//! and hash helpers stay dependency-free for callers that only need them.

use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

use anchor_client::solana_sdk::message::Message;
use anchor_client::solana_sdk::transaction::Transaction;
use anchor_client::{Client, Program};

// Re-exported under their canonical names: brings them into scope here and lets
// callers drive the client without depending on `anchor-client` directly.
pub use anchor_client::solana_sdk::commitment_config::CommitmentConfig;
pub use anchor_client::solana_sdk::instruction::{AccountMeta, Instruction};
pub use anchor_client::solana_sdk::pubkey::Pubkey;
pub use anchor_client::solana_sdk::signature::{read_keypair_file, Keypair, Signature, Signer};
pub use anchor_client::Cluster;

use anchor_lang::system_program::ID as SYSTEM_PROGRAM_ID;

use solana_rpc_client_api::config::RpcSimulateTransactionConfig;
use solana_rpc_client_api::filter::{Memcmp, RpcFilterType};
use solana_rpc_client_api::response::RpcSimulateTransactionResult;

use cordon::state::{Agent, PendingStatus, PendingTx, Policy};
use cordon::ID as CORDON_PROGRAM_ID;
use thiserror::Error;

use crate::outcome::{preview, PolicyDenial, PolicyOutcome};
use crate::pda::{find_pending_pda, find_policy_pda};

/// Errors surfaced by the async client.
#[derive(Debug, Error)]
pub enum CordonClientError {
    /// An Anchor request or account fetch failed.
    #[error(transparent)]
    Anchor(#[from] anchor_client::ClientError),

    /// A raw RPC call (blockhash, simulation) failed.
    #[error("rpc error: {0}")]
    Rpc(String),

    /// The local policy preview rejected the transaction before submission.
    #[error("policy denied the transaction: {0}")]
    Denied(#[from] PolicyDenial),

    /// Helius/RPC simulation reported the transaction would fail on-chain.
    #[error("simulation failed: {message}")]
    SimulationFailed {
        message: String,
        logs: Vec<String>,
    },
}

type Result<T> = std::result::Result<T, CordonClientError>;

/// A transaction the agent wants to broadcast, described in the terms the
/// policy cares about. If `instructions` are supplied they are simulated
/// before submission and used to derive the audit `tx_hash`.
#[derive(Clone, Default)]
pub struct Candidate {
    pub lamports: u64,
    pub target_program: Pubkey,
    pub instructions: Vec<Instruction>,
    pub explicit_hash: Option<[u8; 32]>,
}

impl Candidate {
    pub fn new(lamports: u64, target_program: Pubkey) -> Self {
        Self {
            lamports,
            target_program,
            instructions: Vec::new(),
            explicit_hash: None,
        }
    }

    /// Attach the real downstream instructions so the client can simulate them
    /// and hash them into the on-chain audit reference.
    pub fn with_instructions(mut self, instructions: Vec<Instruction>) -> Self {
        self.instructions = instructions;
        self
    }

    /// Override the audit hash instead of deriving it from the instructions.
    pub fn with_hash(mut self, hash: [u8; 32]) -> Self {
        self.explicit_hash = Some(hash);
        self
    }

    fn resolve_hash(&self, payer: &Pubkey) -> [u8; 32] {
        self.explicit_hash.unwrap_or_else(|| {
            let message = Message::new(&self.instructions, Some(payer));
            crate::hash::tx_hash(&message.serialize())
        })
    }
}

/// The result of running a candidate through the firewall.
#[derive(Debug, Clone)]
pub enum GuardOutcome {
    /// Under the HITL threshold; the program auto-approved and recorded it.
    AutoApproved {
        signature: Signature,
        tx_hash: [u8; 32],
    },
    /// Over the threshold; a `PendingTx` was created for human review.
    Queued {
        signature: Signature,
        pending: Pubkey,
        nonce: u64,
        tx_hash: [u8; 32],
    },
}

/// Async client over the Cordon Anchor program. The `payer` it is constructed
/// with is the fee payer and default signer; instruction-specific signers
/// (the agent key, the policy authority) are passed per call.
pub struct CordonClient {
    program: Program<Arc<Keypair>>,
    payer: Arc<Keypair>,
}

impl CordonClient {
    /// Build a client against an explicit [`Cluster`].
    pub fn new(cluster: Cluster, payer: Arc<Keypair>, commitment: CommitmentConfig) -> Result<Self> {
        let client = Client::new_with_options(cluster, payer.clone(), commitment);
        let program = client.program(CORDON_PROGRAM_ID)?;
        Ok(Self { program, payer })
    }

    /// Build a client from a single RPC URL (e.g. a Helius endpoint). The
    /// websocket URL is derived by swapping the scheme.
    pub fn new_with_rpc(rpc_url: impl Into<String>, payer: Arc<Keypair>) -> Result<Self> {
        let http = rpc_url.into();
        let ws = http.replacen("https", "wss", 1).replacen("http", "ws", 1);
        Self::new(
            Cluster::Custom(http, ws),
            payer,
            CommitmentConfig::confirmed(),
        )
    }

    /// The fee payer / default signer pubkey.
    pub fn payer(&self) -> Pubkey {
        self.payer.pubkey()
    }

    // --- account fetches -------------------------------------------------

    pub async fn fetch_agent(&self, agent: Pubkey) -> Result<Agent> {
        Ok(self.program.account::<Agent>(agent).await?)
    }

    pub async fn fetch_policy(&self, agent: Pubkey) -> Result<Policy> {
        let (policy, _) = find_policy_pda(&agent);
        Ok(self.program.account::<Policy>(policy).await?)
    }

    pub async fn fetch_pending(&self, pending: Pubkey) -> Result<PendingTx> {
        Ok(self.program.account::<PendingTx>(pending).await?)
    }

    /// All still-pending `PendingTx` accounts for an agent, via a memcmp on the
    /// agent pubkey (first field after the 8-byte discriminator).
    pub async fn pending_for_agent(&self, agent: Pubkey) -> Result<Vec<(Pubkey, PendingTx)>> {
        let filters = vec![RpcFilterType::Memcmp(Memcmp::new_raw_bytes(
            8,
            agent.to_bytes().to_vec(),
        ))];
        let mut all = self.program.accounts::<PendingTx>(filters).await?;
        all.retain(|(_, p)| p.status == PendingStatus::Pending);
        all.sort_by_key(|(_, p)| p.proposed_at);
        Ok(all)
    }

    // --- Helius / RPC simulation hook ------------------------------------

    /// Simulate the candidate instructions against the connected RPC. Errors if
    /// the simulation reports the transaction would fail on-chain. Returns the
    /// raw simulation result (compute units, logs) on success.
    pub async fn simulate(&self, instructions: &[Instruction]) -> Result<RpcSimulateTransactionResult> {
        let rpc = self.program.rpc();
        let message = Message::new(instructions, Some(&self.payer.pubkey()));
        let tx = Transaction::new_unsigned(message);
        let config = RpcSimulateTransactionConfig {
            sig_verify: false,
            replace_recent_blockhash: true,
            ..Default::default()
        };
        let response = rpc
            .simulate_transaction_with_config(&tx, config)
            .await
            .map_err(|e| CordonClientError::Rpc(e.to_string()))?;
        let value = response.value;
        if let Some(err) = value.err {
            return Err(CordonClientError::SimulationFailed {
                message: err.to_string(),
                logs: value.logs.clone().unwrap_or_default(),
            });
        }
        Ok(value)
    }

    // --- the firewall path -----------------------------------------------

    /// Run a candidate transaction through the full firewall: fetch policy,
    /// preview it, simulate (if instructions are attached), then auto-submit or
    /// queue for human review.
    pub async fn guard(
        &self,
        agent_signer: &Arc<Keypair>,
        agent: Pubkey,
        candidate: &Candidate,
    ) -> Result<GuardOutcome> {
        let agent_account = self.fetch_agent(agent).await?;
        let policy = self.program.account::<Policy>(agent_account.policy).await?;

        let outcome = preview(
            &policy,
            agent_account.enabled,
            candidate.lamports,
            &candidate.target_program,
            now_unix(),
        )?;

        if !candidate.instructions.is_empty() {
            self.simulate(&candidate.instructions).await?;
        }

        let tx_hash = candidate.resolve_hash(&self.payer.pubkey());

        match outcome {
            PolicyOutcome::AutoApprove => {
                let signature = self
                    .submit_auto(agent_signer, agent, tx_hash, candidate.lamports, candidate.target_program)
                    .await?;
                Ok(GuardOutcome::AutoApproved { signature, tx_hash })
            }
            PolicyOutcome::HumanReview => {
                let (signature, pending, nonce) = self
                    .submit_for_review(agent_signer, agent, tx_hash, candidate.lamports, candidate.target_program)
                    .await?;
                Ok(GuardOutcome::Queued {
                    signature,
                    pending,
                    nonce,
                    tx_hash,
                })
            }
        }
    }

    // --- instruction builders --------------------------------------------

    /// Register a new agent and seed its policy. Only the fee payer signs;
    /// `authority` and `agent_signer` are recorded but do not sign here.
    pub async fn register_agent(
        &self,
        authority: Pubkey,
        agent_signer: Pubkey,
        max_lamports_per_tx: u64,
        hitl_threshold_lamports: u64,
        daily_volume_ceiling: u64,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<(Signature, Pubkey, Pubkey)> {
        let (agent, _) = crate::pda::find_agent_pda(&agent_signer);
        let (policy, _) = find_policy_pda(&agent);
        let signature = self
            .program
            .request()
            .accounts(cordon::accounts::RegisterAgent {
                payer: self.payer.pubkey(),
                authority,
                agent_signer,
                agent,
                policy,
                system_program: SYSTEM_PROGRAM_ID,
            })
            .args(cordon::instruction::RegisterAgent {
                max_lamports_per_tx,
                hitl_threshold_lamports,
                daily_volume_ceiling,
                allowed_programs,
            })
            .send()
            .await?;
        Ok((signature, agent, policy))
    }

    pub async fn set_policy(
        &self,
        authority: &Arc<Keypair>,
        agent: Pubkey,
        max_lamports_per_tx: u64,
        hitl_threshold_lamports: u64,
        daily_volume_ceiling: u64,
        allowed_programs: Vec<Pubkey>,
    ) -> Result<Signature> {
        let (policy, _) = find_policy_pda(&agent);
        Ok(self
            .program
            .request()
            .accounts(cordon::accounts::SetPolicy {
                authority: authority.pubkey(),
                agent,
                policy,
            })
            .args(cordon::instruction::SetPolicy {
                max_lamports_per_tx,
                hitl_threshold_lamports,
                daily_volume_ceiling,
                allowed_programs,
            })
            .signer(authority.clone())
            .send()
            .await?)
    }

    pub async fn set_enabled(
        &self,
        authority: &Arc<Keypair>,
        agent: Pubkey,
        enabled: bool,
    ) -> Result<Signature> {
        Ok(self
            .program
            .request()
            .accounts(cordon::accounts::SetEnabled {
                authority: authority.pubkey(),
                agent,
            })
            .args(cordon::instruction::SetEnabled { enabled })
            .signer(authority.clone())
            .send()
            .await?)
    }

    pub async fn submit_auto(
        &self,
        agent_signer: &Arc<Keypair>,
        agent: Pubkey,
        tx_hash: [u8; 32],
        lamports: u64,
        target_program: Pubkey,
    ) -> Result<Signature> {
        let (policy, _) = find_policy_pda(&agent);
        Ok(self
            .program
            .request()
            .accounts(cordon::accounts::SubmitAuto {
                agent_signer: agent_signer.pubkey(),
                agent,
                policy,
            })
            .args(cordon::instruction::SubmitAuto {
                tx_hash,
                lamports,
                target_program,
            })
            .signer(agent_signer.clone())
            .send()
            .await?)
    }

    /// Queue a high-value tx for review. Returns the signature, the created
    /// `PendingTx` PDA, and the nonce it was assigned.
    pub async fn submit_for_review(
        &self,
        agent_signer: &Arc<Keypair>,
        agent: Pubkey,
        tx_hash: [u8; 32],
        lamports: u64,
        target_program: Pubkey,
    ) -> Result<(Signature, Pubkey, u64)> {
        let agent_account = self.fetch_agent(agent).await?;
        let nonce = agent_account.next_pending_nonce;
        let (policy, _) = find_policy_pda(&agent);
        let (pending, _) = find_pending_pda(&agent, nonce);
        let signature = self
            .program
            .request()
            .accounts(cordon::accounts::SubmitForReview {
                payer: self.payer.pubkey(),
                agent_signer: agent_signer.pubkey(),
                agent,
                policy,
                pending,
                system_program: SYSTEM_PROGRAM_ID,
            })
            .args(cordon::instruction::SubmitForReview {
                tx_hash,
                lamports,
                target_program,
            })
            .signer(agent_signer.clone())
            .send()
            .await?;
        Ok((signature, pending, nonce))
    }

    pub async fn approve_tx(
        &self,
        authority: &Arc<Keypair>,
        agent: Pubkey,
        pending: Pubkey,
        rent_receiver: Pubkey,
    ) -> Result<Signature> {
        let (policy, _) = find_policy_pda(&agent);
        Ok(self
            .program
            .request()
            .accounts(cordon::accounts::ApproveTx {
                authority: authority.pubkey(),
                rent_receiver,
                agent,
                policy,
                pending,
            })
            .args(cordon::instruction::ApproveTx)
            .signer(authority.clone())
            .send()
            .await?)
    }

    pub async fn reject_tx(
        &self,
        authority: &Arc<Keypair>,
        agent: Pubkey,
        pending: Pubkey,
        rent_receiver: Pubkey,
        reason_code: u8,
    ) -> Result<Signature> {
        Ok(self
            .program
            .request()
            .accounts(cordon::accounts::RejectTx {
                authority: authority.pubkey(),
                rent_receiver,
                agent,
                pending,
            })
            .args(cordon::instruction::RejectTx { reason_code })
            .signer(authority.clone())
            .send()
            .await?)
    }
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}
