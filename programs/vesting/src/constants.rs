use super::*;
use solana_program::pubkey;

#[constant]
pub const MONTHLY_TIMESTAMP: i64 = 60 * 60 * 24 * 30; // Assume 30 days per month TODO

#[constant]
pub const GLOBAL_STATE_TAG: &[u8] = b"global";

#[constant]
pub const ESCROW_TAG: &[u8] = b"escrow";

#[constant]
pub const RECIPIENT_TAG: &[u8] = b"recipient";

#[constant]
pub const LOCK_STATE_TAG: &[u8] = b"lock";

#[constant]
pub const THE_RECIPIENT: Pubkey = pubkey!("DTA8PmpWqW9zssr49wcbEjYiNdDx23NXBxy6kNSvxPUR");
