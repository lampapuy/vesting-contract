use core::panic;

use super::{GlobalState, StreamInstruction, ESCROW_TAG, GLOBAL_STATE_TAG, LOCK_STATE_TAG};

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::{CustomError, StreamParams};
/// Function to lock the tokens for specific period of time with other
/// scheduling details.
///
/// This function can produce the following error:-
///  -  `InsufficientFunds` when the user vault doesn't contain the requested
///     staked amount.
pub fn process_stake(ctx: Context<Stake>, stream_params: StreamParams) -> Result<()> {
    // Check user balance first
    require!(
        ctx.accounts.user_vault.amount >= stream_params.staked_amount,
        CustomError::InsufficientFunds
    );

    // Transfer tokens from user to vault's account
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.user_vault.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.escrow_account.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    transfer_checked(
        CpiContext::new(cpi_program, cpi_accounts),
        stream_params.staked_amount,
        stream_params.decimals as u8,
    )?;
    // Store stake information
    let stream = &mut ctx.accounts.stream;
    stream.store(stream_params)?;

    Ok(())
}

#[derive(Accounts)]
#[instruction()]
pub struct Stake<'info> {
    #[account(
        seeds = [GLOBAL_STATE_TAG],
        bump,
    )]
    pub global_state: AccountLoader<'info, GlobalState>,

    #[account(
        init,
        seeds = [LOCK_STATE_TAG, authority.key().as_ref()],
        bump,
        payer = authority,
        space = std::mem::size_of::<StreamInstruction>() + 8
    )]
    pub stream: Box<Account<'info, StreamInstruction>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = escrow_account,
        seeds = [ESCROW_TAG],
        bump,
    )]
    pub escrow_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = authority.key() == user_vault.owner,
        token::mint = mint,
    )]
    pub user_vault: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub authority: Signer<'info>,

    pub mint: Box<Account<'info, Mint>>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    pub rent: Sysvar<'info, Rent>,
}
