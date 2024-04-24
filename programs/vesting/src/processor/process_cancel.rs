use core::panic;

use crate::{calc_next_pay_date, calc_pay_amount, CustomError};

use super::{GlobalState, StreamInstruction, ESCROW_TAG, GLOBAL_STATE_TAG, LOCK_STATE_TAG};
use anchor_spl::{associated_token::get_associated_token_address_with_program_id, token::Token};

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, Mint, TokenAccount, TransferChecked};

/// Function to cancel vesting schedule at any time by the user who locked the
/// tokens.
///
/// Throws `AccountNotInitialized` error when called by any account other than
/// user who locked the tokens.
pub fn process_cancel(ctx: Context<Cancel>) -> Result<()> {
    let stream = &mut ctx.accounts.stream;

    // Find bump for vault PDA
    let (_, bump) = Pubkey::find_program_address(&[ESCROW_TAG], &crate::ID);

    // Transfer reward amount from vault to user's account
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_accounts = TransferChecked {
        from: ctx.accounts.escrow_account.to_account_info(),
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.user_vault.to_account_info(),
        authority: ctx.accounts.escrow_account.to_account_info(),
    };

    transfer_checked(
        CpiContext::new_with_signer(cpi_program, cpi_accounts, &[&[ESCROW_TAG, &[bump]]]),
        stream.remaining_amount,
        stream.decimals as u8,
    )?;
    Ok(())
}

#[derive(Accounts)]
#[instruction()]
pub struct Cancel<'info> {
    #[account(
        seeds = [GLOBAL_STATE_TAG],
        bump,
    )]
    pub global_state: AccountLoader<'info, GlobalState>,

    #[account(
        mut,
        seeds = [LOCK_STATE_TAG, authority.key().as_ref()],
        bump,
    )]
    pub stream: Box<Account<'info, StreamInstruction>>,

    #[account(
        mut,
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
