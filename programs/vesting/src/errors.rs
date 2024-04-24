use super::*;

#[error_code]
pub enum CustomError {
    #[msg("Error: You need to wait at least lockup period.")]
    TokensStillLocked,

    #[msg("Error: Your balance is not enough.")]
    InsufficientFunds,

    #[msg("Error: Invalid ATA Escrow.")]
    InvalidATA,
}
