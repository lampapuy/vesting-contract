use super::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program;
#[account(zero_copy)]
#[repr(C)]
pub struct GlobalState {
    pub mint: Pubkey,
}

impl GlobalState {
    pub fn save(&mut self, mint: Pubkey) {
        self.mint = mint;
    }
}

/// The struct containing instructions for initializing a stream
#[account]
#[derive(Default)]
pub struct StreamInstruction {
    /// Timestamp when the tokens start vesting
    pub start_time: i64,
    /// Timestamp when all tokens are fully vested
    pub end_time: i64,
    /// Initial staked amount
    pub initial_staked_amount: u64,
    /// Staked amount left
    pub remaining_amount: u64,
    /// Vesting contract "cliff" months
    pub cliff: u32,
    /// Amount unlocked at the "cliff" timestamp
    pub cliff_rate: u64,
    /// Release frequency of recurring payment in months
    pub release_frequency: u32,
    /// Release rate of recurring payment
    pub release_rate: u64,
    /// The name of this stream
    pub stream_name: String,
    /// Timestamp when the tokens were last claimed
    pub last_claimed_at: i64,
    /// Timestamp when the tokens will be paid next
    pub next_pay_at: i64,
    /// Amount of tokens to be payed next
    pub next_pay_amount: u64,
    /// Decimals supported by the token
    pub decimals: u32,
}

impl StreamInstruction {
    pub fn store(&mut self, stream: StreamParams) -> Result<()> {
        self.start_time = stream.start_time;
        self.end_time = stream.end_time;
        self.initial_staked_amount = stream.based_stake; // 1b for lpp
        self.remaining_amount = stream.staked_amount;
        self.cliff = stream.cliff;
        self.cliff_rate = stream.cliff_rate;
        self.release_frequency = stream.release_frequency;
        self.release_rate = stream.release_rate;
        self.stream_name = stream.stream_name;
        self.decimals = stream.decimals;
        self.next_pay_at = calc_next_pay_date(stream.start_time, stream.cliff);

        self.next_pay_amount = calc_pay_amount(
            stream.based_stake as u128,
            stream.cliff_rate as u128,
            stream.decimals,
        ) as u64;

        Ok(())
    }
}

/// The struct containing instructions for initializing a stream
#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct StreamParams {
    /// Timestamp when the tokens start vesting
    pub start_time: i64,
    /// Timestamp when all tokens are fully vested
    pub end_time: i64,
    /// Staked amount
    pub staked_amount: u64,

    /// Based Stake to calculate from
    pub based_stake: u64,

    /// Vesting contract "cliff" months
    pub cliff: u32,
    /// Amount unlocked at the "cliff" timestamp
    pub cliff_rate: u64,
    /// Release frequency of recurring payment in months
    pub release_frequency: u32,
    /// Release rate of recurring payment
    pub release_rate: u64,
    /// The name of this stream
    pub stream_name: String,
    /// Decimals supported by the token
    pub decimals: u32,
}
