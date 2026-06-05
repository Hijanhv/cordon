use anchor_lang::prelude::*;

pub const MAX_ALLOWED_PROGRAMS: usize = 16;
pub const VOLUME_WINDOW_SECS: i64 = 86_400;

#[account]
#[derive(InitSpace)]
pub struct Policy {
    pub agent: Pubkey,
    pub authority: Pubkey,
    pub max_lamports_per_tx: u64,
    pub hitl_threshold_lamports: u64,
    pub daily_volume_ceiling: u64,
    pub volume_today: u64,
    pub volume_window_start: i64,
    #[max_len(MAX_ALLOWED_PROGRAMS)]
    pub allowed_programs: Vec<Pubkey>,
    pub updated_at: i64,
    pub bump: u8,
}

impl Policy {
    pub const SEED_PREFIX: &'static [u8] = b"policy";

    pub fn program_allowed(&self, program: &Pubkey) -> bool {
        self.allowed_programs.iter().any(|p| p == program)
    }

    pub fn account_for_spend(&mut self, lamports: u64, now: i64) {
        if now - self.volume_window_start >= VOLUME_WINDOW_SECS {
            self.volume_today = 0;
            self.volume_window_start = now;
        }
        self.volume_today = self.volume_today.saturating_add(lamports);
    }

    pub fn would_exceed_volume(&self, lamports: u64, now: i64) -> bool {
        let projected = if now - self.volume_window_start >= VOLUME_WINDOW_SECS {
            lamports
        } else {
            self.volume_today.saturating_add(lamports)
        };
        projected > self.daily_volume_ceiling
    }
}
